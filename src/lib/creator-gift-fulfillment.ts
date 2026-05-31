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
  notifyCreatorGiftGoogleShoppingCredits,
  notifyCreatorGiftListingCredits,
  notifyCreatorGiftPromotionCredits,
  notifyCreatorGiftShopFlair,
} from "@/lib/creator-gift-notices";
import { defaultGiftRedemptionEmailVars } from "@/lib/gift-redemption-code-email-html";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { prisma } from "@/lib/prisma";
import { promotionKindLabel } from "@/lib/promotions";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { sendGiftRedemptionCodeEmail } from "@/lib/send-gift-redemption-code-email";

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

async function markPurchasePaid(
  tx: Prisma.TransactionClient,
  args: {
    purchaseId: string;
    session: Stripe.Checkout.Session;
    paymentIntentId: string | null;
    purchaserEmail?: string | null;
  },
) {
  const stripeEmail = checkoutSessionEmail(args.session);
  const purchaserEmail = args.purchaserEmail?.trim() || stripeEmail || null;

  await tx.creatorGiftPurchase.update({
    where: { id: args.purchaseId },
    data: {
      status: CreatorGiftPurchaseStatus.paid,
      paidAt: new Date(),
      stripeCheckoutSessionId: args.session.id,
      ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
      ...(purchaserEmail ? { purchaserEmail } : {}),
    },
  });
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
  if (session.payment_status !== "paid") return true;

  const paidAmountCents =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total
      : undefined;
  const paymentIntentId = paymentIntentIdFromCheckoutSession(session);

  const purchase = await prisma.creatorGiftPurchase.findUnique({
    where: { id: purchaseId },
    include: { codes: true },
  });
  if (!purchase) return true;
  if (
    purchase.status !== CreatorGiftPurchaseStatus.pending &&
    purchase.status !== CreatorGiftPurchaseStatus.paid
  ) {
    return true;
  }
  if (paidAmountCents !== undefined && paidAmountCents !== purchase.amountCents) {
    return true;
  }

  if (purchase.fulfillmentMode === CreatorGiftFulfillmentMode.direct_to_shop) {
    if (purchase.status === CreatorGiftPurchaseStatus.pending) {
      const result = await prisma.$transaction(async (tx) => {
        await markPurchasePaid(tx, {
          purchaseId: purchase.id,
          session,
          paymentIntentId,
        });
        return applyDirectToShopCredits(tx, purchase);
      });
      if (!result.ok) return true;

      const { shopId } = result;
      const giftFromName = purchase.giftFromName;

      if (purchase.listingCreditsGranted > 0) {
        await syncFreeListingFeeWaivers(shopId);
        await notifyCreatorGiftListingCredits({
          shopId,
          creditsGranted: purchase.listingCreditsGranted,
          giftFromName,
        });
      }
      if (purchase.promotionCreditsGranted > 0 && purchase.promotionKind) {
        await notifyCreatorGiftPromotionCredits({
          shopId,
          kind: purchase.promotionKind,
          creditsGranted: purchase.promotionCreditsGranted,
          giftFromName,
        });
      }
      if (purchase.googleShoppingCreditsGranted > 0) {
        await notifyCreatorGiftGoogleShoppingCredits({
          shopId,
          creditsGranted: purchase.googleShoppingCreditsGranted,
          giftFromName,
        });
      }
      if (purchase.shopFlairIncluded) {
        await notifyCreatorGiftShopFlair({ shopId, giftFromName });
        revalidateShopUpgradesDashboardPaths();
      }
    }
    return true;
  }

  const purchaserEmail = purchase.purchaserEmail?.trim() || checkoutSessionEmail(session);
  if (!purchaserEmail) {
    console.error("[creator-gift] Stripe checkout completed without a purchaser email", {
      purchaseId: purchase.id,
      checkoutSessionId: session.id,
    });
    return true;
  }

  const fulfilled = await prisma.$transaction(async (tx) => {
    if (purchase.status === CreatorGiftPurchaseStatus.pending) {
      await markPurchasePaid(tx, {
        purchaseId: purchase.id,
        session,
        paymentIntentId,
        purchaserEmail,
      });
    } else if (purchase.purchaserEmail !== purchaserEmail) {
      await tx.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: { purchaserEmail },
      });
    }

    const codes = await fulfillEmailCodesGift(tx, purchase);

    const setupCode =
      codes.find((c) => c.type === CreatorGiftCodeType.shop_setup)?.code ?? "Not included";
    const listingCode =
      codes.find((c) => c.type === CreatorGiftCodeType.listing_credits)?.code ?? "Not included";
    const promotionRow = codes.find((c) => c.type === CreatorGiftCodeType.promotion_credit);
    const googleRow = codes.find((c) => c.type === CreatorGiftCodeType.google_shopping_credits);

    return {
      purchaseId: purchase.id,
      purchaserEmail,
      emailedAt: purchase.emailedAt,
      emailVars: defaultGiftRedemptionEmailVars({
        setupCode,
        listingCode,
        listingCredits: String(purchase.listingCreditsGranted || 0),
        promotionCode: promotionRow?.code ?? "Not included",
        promotionKindLabel: purchase.promotionKind
          ? promotionKindLabel(purchase.promotionKind)
          : "—",
        promotionCredits: String(purchase.promotionCreditsGranted || 0),
        googleShoppingCode: googleRow?.code ?? "Not included",
        googleShoppingCredits: String(purchase.googleShoppingCreditsGranted || 0),
      }),
    };
  });

  if (!fulfilled.emailedAt) {
    const send = await sendGiftRedemptionCodeEmail({
      toEmail: fulfilled.purchaserEmail,
      ...fulfilled.emailVars,
    });
    if (send.ok) {
      await prisma.creatorGiftPurchase.update({
        where: { id: fulfilled.purchaseId },
        data: { emailedAt: new Date() },
      });
    } else {
      console.error("[creator-gift] email failed:", send.error);
    }
  }
  return true;
}
