import type Stripe from "stripe";
import type { Prisma } from "@/generated/prisma/client";
import {
  CreatorGiftCodeType,
  CreatorGiftFulfillmentMode,
  CreatorGiftPurchaseStatus,
  PromotionKind,
  ShopFlairPurchaseStatus,
  ShopUserRole,
} from "@/generated/prisma/enums";
import { generateCreatorGiftCode } from "@/lib/creator-gift-codes";
import {
  notifyCreatorGiftReceived,
} from "@/lib/creator-gift-notices";
import { defaultGiftRedemptionEmailVars } from "@/lib/gift-redemption-code-email-html";
import {
  parseCreatorGiftMockSessionId,
} from "@/lib/creator-gift-mock-checkout";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { prisma } from "@/lib/prisma";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { sendGiftRedemptionCodeEmail } from "@/lib/send-gift-redemption-code-email";
import { getStripe } from "@/lib/stripe";

function paymentIntentIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return String(pi.id);
  return null;
}

function checkoutSessionEmail(session: Stripe.Checkout.Session): string {
  return (
    session.customer_details?.email ??
    session.customer_email ??
    ""
  )
    .trim()
    .toLowerCase();
}

function isCreatorGiftCheckoutSessionPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

/** Idempotent: send redemption email when purchase is paid and not yet emailed. */
export async function ensureCreatorGiftRedemptionEmailSent(
  purchaseId: string,
): Promise<{ sent: boolean; error: string | null }> {
  const purchase = await prisma.creatorGiftPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      codes: {
        where: { type: CreatorGiftCodeType.shop_setup },
        select: { code: true },
        take: 1,
      },
    },
  });
  if (!purchase) return { sent: false, error: "Gift purchase not found." };
  if (purchase.fulfillmentMode !== CreatorGiftFulfillmentMode.email_codes) {
    return { sent: true, error: null };
  }
  if (purchase.emailedAt) return { sent: true, error: null };
  if (purchase.status !== CreatorGiftPurchaseStatus.paid) {
    return { sent: false, error: "Gift purchase is not marked paid yet." };
  }

  const purchaserEmail = purchase.purchaserEmail?.trim();
  if (!purchaserEmail) {
    return { sent: false, error: "Missing purchaser email on gift purchase." };
  }

  const setupCode = purchase.codes[0]?.code ?? "Not included";
  const send = await sendGiftRedemptionCodeEmail({
    toEmail: purchaserEmail,
    ...defaultGiftRedemptionEmailVars({ setupCode }),
  });
  if (!send.ok) {
    console.error("[creator-gift] email failed:", send.error);
    return { sent: false, error: send.error };
  }

  await prisma.creatorGiftPurchase.update({
    where: { id: purchaseId },
    data: { emailedAt: new Date() },
  });
  return { sent: true, error: null };
}

async function fulfillCreatorGiftPurchaseRecord(
  purchaseId: string,
  payment: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    purchaserEmail?: string | null;
    paidAmountCents?: number;
  },
): Promise<boolean> {
  const purchase = await prisma.creatorGiftPurchase.findUnique({
    where: { id: purchaseId },
    include: { codes: true },
  });
  if (!purchase) return false;
  if (
    purchase.status !== CreatorGiftPurchaseStatus.pending &&
    purchase.status !== CreatorGiftPurchaseStatus.paid
  ) {
    return false;
  }

  if (
    payment.paidAmountCents !== undefined &&
    payment.paidAmountCents !== purchase.amountCents
  ) {
    console.warn("[creator-gift] paid amount mismatch; fulfilling anyway", {
      purchaseId: purchase.id,
      expectedCents: purchase.amountCents,
      paidCents: payment.paidAmountCents,
    });
  }

  if (purchase.fulfillmentMode === CreatorGiftFulfillmentMode.direct_to_shop) {
    if (purchase.status === CreatorGiftPurchaseStatus.pending) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.creatorGiftPurchase.update({
          where: { id: purchase.id },
          data: {
            status: CreatorGiftPurchaseStatus.paid,
            paidAt: new Date(),
            ...(payment.stripeCheckoutSessionId
              ? { stripeCheckoutSessionId: payment.stripeCheckoutSessionId }
              : {}),
            ...(payment.stripePaymentIntentId
              ? { stripePaymentIntentId: payment.stripePaymentIntentId }
              : {}),
          },
        });
        return applyDirectToShopCredits(tx, purchase);
      });
      if (!result.ok) return false;

      const { shopId } = result;
      const giftFromName = purchase.giftFromName;

      if (purchase.listingCreditsGranted > 0) {
        await syncFreeListingFeeWaivers(shopId);
      }
      await notifyCreatorGiftReceived({
        shopId,
        giftFromName,
        listingCreditsGranted: purchase.listingCreditsGranted,
        promotionKind: purchase.promotionKind,
        promotionCreditsGranted: purchase.promotionCreditsGranted,
        googleShoppingCreditsGranted: purchase.googleShoppingCreditsGranted,
        shopFlairIncluded: purchase.shopFlairIncluded,
      });
      if (purchase.shopFlairIncluded) {
        revalidateShopUpgradesDashboardPaths();
      }
    }
    return true;
  }

  const purchaserEmail =
    payment.purchaserEmail?.trim() || purchase.purchaserEmail?.trim() || null;
  if (!purchaserEmail) {
    console.error("[creator-gift] missing purchaser email", { purchaseId: purchase.id });
    return false;
  }

  await prisma.$transaction(async (tx) => {
    if (purchase.status === CreatorGiftPurchaseStatus.pending) {
      await tx.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: {
          status: CreatorGiftPurchaseStatus.paid,
          paidAt: new Date(),
          purchaserEmail,
          ...(payment.stripeCheckoutSessionId
            ? { stripeCheckoutSessionId: payment.stripeCheckoutSessionId }
            : {}),
          ...(payment.stripePaymentIntentId
            ? { stripePaymentIntentId: payment.stripePaymentIntentId }
            : {}),
        },
      });
    } else if (purchase.purchaserEmail !== purchaserEmail) {
      await tx.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: { purchaserEmail },
      });
    }

    await fulfillEmailCodesGift(tx, purchase);
  });

  await ensureCreatorGiftRedemptionEmailSent(purchaseId);
  return true;
}

type FulfilledGiftCode = {
  type: CreatorGiftCodeType;
  code: string;
  listingCreditsGranted: number;
  googleShoppingCreditsGranted: number;
  promotionKind: PromotionKind | null;
  promotionCreditsGranted: number;
};

function giftCodePrefix(type: CreatorGiftCodeType): "SETUP" | "LIST" | "PROMO" | "GMC" {
  switch (type) {
    case CreatorGiftCodeType.shop_setup:
      return "SETUP";
    case CreatorGiftCodeType.listing_credits:
      return "LIST";
    case CreatorGiftCodeType.promotion_credit:
      return "PROMO";
    case CreatorGiftCodeType.google_shopping_credits:
      return "GMC";
    default:
      return "LIST";
  }
}

async function createUniqueGiftCode(
  tx: Prisma.TransactionClient,
  args: {
    purchaseId: string;
    type: CreatorGiftCodeType;
    listingCreditsGranted?: number;
    googleShoppingCreditsGranted?: number;
    promotionKind?: PromotionKind | null;
    promotionCreditsGranted?: number;
  },
) {
  const prefix = giftCodePrefix(args.type);
  for (let i = 0; i < 5; i++) {
    const code = generateCreatorGiftCode(prefix);
    try {
      return await tx.creatorGiftCode.create({
        data: {
          purchaseId: args.purchaseId,
          type: args.type,
          code: code.code,
          codeNormalized: code.codeNormalized,
          listingCreditsGranted: args.listingCreditsGranted ?? 0,
          googleShoppingCreditsGranted: args.googleShoppingCreditsGranted ?? 0,
          promotionKind: args.promotionKind ?? null,
          promotionCreditsGranted: args.promotionCreditsGranted ?? 0,
        },
        select: {
          code: true,
          type: true,
          listingCreditsGranted: true,
          googleShoppingCreditsGranted: true,
          promotionKind: true,
          promotionCreditsGranted: true,
        },
      });
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  throw new Error("Could not generate a unique gift code.");
}

async function applyDirectToShopCredits(
  tx: Prisma.TransactionClient,
  purchase: {
    id: string;
    recipientShopId: string | null;
    listingCreditsGranted: number;
    googleShoppingCreditsGranted: number;
    promotionKind: PromotionKind | null;
    promotionCreditsGranted: number;
    shopFlairIncluded: boolean;
  },
): Promise<{ ok: true; shopId: string } | { ok: false }> {
  if (!purchase.recipientShopId) {
    console.error("[creator-gift] direct gift missing recipientShopId", { purchaseId: purchase.id });
    return { ok: false };
  }

  const shopId = purchase.recipientShopId;

  if (purchase.listingCreditsGranted > 0) {
    await tx.shop.update({
      where: { id: shopId },
      data: { listingFeeBonusFreeSlots: { increment: purchase.listingCreditsGranted } },
    });
  }

  if (purchase.promotionCreditsGranted > 0 && purchase.promotionKind) {
    await tx.shopPromotionCreditBalance.upsert({
      where: { shopId_kind: { shopId, kind: purchase.promotionKind } },
      create: { shopId, kind: purchase.promotionKind, credits: purchase.promotionCreditsGranted },
      update: { credits: { increment: purchase.promotionCreditsGranted } },
    });
  }

  if (purchase.googleShoppingCreditsGranted > 0) {
    await tx.shop.update({
      where: { id: shopId },
      data: { googleShoppingCredits: { increment: purchase.googleShoppingCreditsGranted } },
    });
  }

  if (purchase.shopFlairIncluded) {
    const shop = await tx.shop.findUnique({
      where: { id: shopId },
      select: { flairPurchasedAt: true },
    });
    if (!shop?.flairPurchasedAt) {
      const owner = await tx.shopUser.findFirst({
        where: { shopId, role: ShopUserRole.owner },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (owner) {
        const now = new Date();
        await tx.shop.update({
          where: { id: shopId },
          data: { flairPurchasedAt: now },
        });
        await tx.shopFlairPurchase.create({
          data: {
            shopId,
            shopUserId: owner.id,
            amountCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
            currency: "usd",
            status: ShopFlairPurchaseStatus.paid,
            paidAt: now,
          },
        });
      }
    }
  }

  return { ok: true, shopId };
}

async function fulfillEmailCodesGift(
  tx: Prisma.TransactionClient,
  purchase: {
    id: string;
    setupFeeIncluded: boolean;
    listingCreditsGranted: number;
    googleShoppingCreditsGranted: number;
    promotionKind: PromotionKind | null;
    promotionCreditsGranted: number;
    codes: Array<{
      type: CreatorGiftCodeType;
      code: string;
      listingCreditsGranted: number;
      googleShoppingCreditsGranted: number;
      promotionKind: PromotionKind | null;
      promotionCreditsGranted: number;
    }>;
  },
): Promise<FulfilledGiftCode[]> {
  const codes: FulfilledGiftCode[] = purchase.codes.map((c) => ({
    type: c.type,
    code: c.code,
    listingCreditsGranted: c.listingCreditsGranted,
    googleShoppingCreditsGranted: c.googleShoppingCreditsGranted,
    promotionKind: c.promotionKind,
    promotionCreditsGranted: c.promotionCreditsGranted,
  }));

  if (
    purchase.setupFeeIncluded &&
    !codes.some((c) => c.type === CreatorGiftCodeType.shop_setup)
  ) {
    codes.push(
      await createUniqueGiftCode(tx, {
        purchaseId: purchase.id,
        type: CreatorGiftCodeType.shop_setup,
      }),
    );
  }
  if (
    purchase.listingCreditsGranted > 0 &&
    !codes.some((c) => c.type === CreatorGiftCodeType.listing_credits)
  ) {
    codes.push(
      await createUniqueGiftCode(tx, {
        purchaseId: purchase.id,
        type: CreatorGiftCodeType.listing_credits,
        listingCreditsGranted: purchase.listingCreditsGranted,
      }),
    );
  }
  if (
    purchase.promotionCreditsGranted > 0 &&
    purchase.promotionKind &&
    !codes.some((c) => c.type === CreatorGiftCodeType.promotion_credit)
  ) {
    codes.push(
      await createUniqueGiftCode(tx, {
        purchaseId: purchase.id,
        type: CreatorGiftCodeType.promotion_credit,
        promotionKind: purchase.promotionKind,
        promotionCreditsGranted: purchase.promotionCreditsGranted,
      }),
    );
  }
  if (
    purchase.googleShoppingCreditsGranted > 0 &&
    !codes.some((c) => c.type === CreatorGiftCodeType.google_shopping_credits)
  ) {
    codes.push(
      await createUniqueGiftCode(tx, {
        purchaseId: purchase.id,
        type: CreatorGiftCodeType.google_shopping_credits,
        googleShoppingCreditsGranted: purchase.googleShoppingCreditsGranted,
      }),
    );
  }

  return codes;
}

export async function fulfillCreatorGiftCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.metadata?.kind !== "creator_gift") return false;
  const purchaseId = session.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (!isCreatorGiftCheckoutSessionPaid(session)) return true;

  const paidAmountCents =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total
      : undefined;

  return fulfillCreatorGiftPurchaseRecord(purchaseId, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentIdFromCheckoutSession(session),
    purchaserEmail: checkoutSessionEmail(session) || undefined,
    paidAmountCents,
  });
}

async function buildFinalizeCreatorGiftCheckoutResult(
  purchaseId: string,
  sessionMetadata?: Stripe.Metadata | Record<string, string> | null,
): Promise<FinalizeCreatorGiftCheckoutResult> {
  await ensureCreatorGiftRedemptionEmailSent(purchaseId);

  const purchase = await prisma.creatorGiftPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      codes: {
        where: { type: CreatorGiftCodeType.shop_setup },
        select: { code: true },
        take: 1,
      },
      recipientShop: { select: { slug: true } },
    },
  });
  if (!purchase) {
    return { ok: false, error: "Gift purchase record not found." };
  }

  const setupCode = purchase.codes[0]?.code ?? null;
  const emailSent = purchase.emailedAt != null;
  const emailPending =
    purchase.fulfillmentMode === CreatorGiftFulfillmentMode.email_codes &&
    purchase.status === CreatorGiftPurchaseStatus.paid &&
    !emailSent;

  const shopSlugFromMeta =
    sessionMetadata && typeof sessionMetadata.recipientShopSlug === "string"
      ? sessionMetadata.recipientShopSlug.trim()
      : "";

  return {
    ok: true,
    fulfillmentMode: purchase.fulfillmentMode,
    purchaserEmail: purchase.purchaserEmail,
    setupCode,
    emailSent,
    emailPending,
    emailError: emailPending
      ? "We could not send the gift code email. Check spam or contact support with your Stripe receipt."
      : null,
    shopSlug: purchase.recipientShop?.slug ?? (shopSlugFromMeta || null),
  };
}

export type FinalizeCreatorGiftCheckoutResult =
  | {
      ok: true;
      fulfillmentMode: CreatorGiftFulfillmentMode;
      purchaserEmail: string | null;
      setupCode: string | null;
      emailSent: boolean;
      emailPending: boolean;
      emailError: string | null;
      shopSlug: string | null;
    }
  | { ok: false; error: string };

/**
 * Success-page fallback when Stripe redirects before the webhook runs (or webhook delivery fails).
 * Idempotent with {@link fulfillCreatorGiftCheckoutSession}.
 */
export async function finalizeCreatorGiftCheckoutSessionId(
  sessionId: string,
): Promise<FinalizeCreatorGiftCheckoutResult> {
  const trimmedSessionId = sessionId.trim();
  const mockPurchaseId = parseCreatorGiftMockSessionId(trimmedSessionId);
  if (mockPurchaseId) {
    if (!isMockCheckoutEnabled()) {
      return { ok: false, error: "Invalid gift checkout session." };
    }
    const purchase = await prisma.creatorGiftPurchase.findUnique({
      where: { id: mockPurchaseId },
      select: { id: true, purchaserEmail: true, amountCents: true },
    });
    if (!purchase) {
      return { ok: false, error: "Gift purchase record not found." };
    }
    await fulfillCreatorGiftPurchaseRecord(mockPurchaseId, {
      stripeCheckoutSessionId: trimmedSessionId,
      paidAmountCents: purchase.amountCents,
      purchaserEmail: purchase.purchaserEmail,
    });
    return buildFinalizeCreatorGiftCheckoutResult(mockPurchaseId, null);
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(trimmedSessionId);
  } catch (e) {
    console.error("[creator-gift] checkout session retrieve failed", e);
    return { ok: false, error: "Could not load checkout session. Try refreshing this page." };
  }

  if (session.metadata?.kind !== "creator_gift") {
    return { ok: false, error: "This checkout is not a creator gift purchase." };
  }
  if (!isCreatorGiftCheckoutSessionPaid(session)) {
    return {
      ok: false,
      error: "Payment is not complete yet. Wait a moment and refresh, or contact support.",
    };
  }

  const purchaseId = session.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") {
    return { ok: false, error: "Gift checkout is missing purchase metadata." };
  }

  await fulfillCreatorGiftCheckoutSession(session);
  return buildFinalizeCreatorGiftCheckoutResult(purchaseId, session.metadata);
}
