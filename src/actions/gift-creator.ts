"use server";

import { CreatorGiftFulfillmentMode, CreatorGiftPurchaseStatus } from "@/generated/prisma/enums";
import { verifyGiftRecipientShop } from "@/actions/gift-creator-shop-search";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { SHOP_SETUP_FEE_CENTS, SHOP_SETUP_FEE_LABEL } from "@/lib/creator-gift-codes";
import { creatorGiftMockSessionId } from "@/lib/creator-gift-mock-checkout";
import { normalizeGiftFromName } from "@/lib/creator-gift-notices";
import { googleShoppingCreditPackById } from "@/lib/google-shopping-credit-packs";
import { listingCreditPackById } from "@/lib/listing-credit-packs";
import { prisma } from "@/lib/prisma";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import {
  SHOP_FLAIR_ACCESS_PRICE_CENTS,
  shopFlairAccessPurchaseLabel,
} from "@/lib/shop-flair";
import {
  PROMOTION_KIND_OPTIONS,
  parsePromotionKind,
  promotionKindLabel,
  promotionPriceCentsForKind,
} from "@/lib/promotions";
import { getStripe } from "@/lib/stripe";
import {
  buyerCheckoutTotalCents,
  stripeCheckoutPaymentProcessingLineItem,
} from "@/lib/stripe-card-processing-fee";

export type StartCreatorGiftCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const PROMOTION_GIFT_KINDS = PROMOTION_KIND_OPTIONS.map((o) => o.kind);
const MAX_PROMOTION_GIFT_CREDITS = 10;

type CheckoutLineItem = {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: { name: string; description?: string };
  };
};

function parseExistingShopGiftOptions(formData: FormData) {
  const includeListingCredits = String(formData.get("includeListingCredits") ?? "") === "on";
  const includePromotionCredits = String(formData.get("includePromotionCredits") ?? "") === "on";
  const includeGoogleShoppingCredits =
    String(formData.get("includeGoogleShoppingCredits") ?? "") === "on";
  const includeShopFlair = String(formData.get("includeShopFlair") ?? "") === "on";

  const listingPackId = String(formData.get("listingCreditPackId") ?? "").trim();
  const listingPack = includeListingCredits && listingPackId ? listingCreditPackById(listingPackId) : null;

  const googlePackId = String(formData.get("googleShoppingCreditPackId") ?? "").trim();
  const googlePack =
    includeGoogleShoppingCredits && googlePackId ? googleShoppingCreditPackById(googlePackId) : null;

  const promotionKindRaw = String(formData.get("promotionKind") ?? "").trim();
  const promotionKind = includePromotionCredits ? parsePromotionKind(promotionKindRaw) : null;
  const promotionCreditsRaw = String(formData.get("promotionCredits") ?? "1").trim();
  const promotionCredits = includePromotionCredits ? Number.parseInt(promotionCreditsRaw, 10) : 0;

  return {
    includeListingCredits,
    includePromotionCredits,
    includeGoogleShoppingCredits,
    includeShopFlair,
    listingPack,
    googlePack,
    promotionKind,
    promotionCredits,
  };
}

function validateExistingShopGiftOptions(
  options: ReturnType<typeof parseExistingShopGiftOptions>,
): StartCreatorGiftCheckoutResult | null {
  const {
    includeListingCredits,
    includePromotionCredits,
    includeGoogleShoppingCredits,
    includeShopFlair,
    listingPack,
    googlePack,
    promotionKind,
    promotionCredits,
  } = options;

  if (includeListingCredits && !listingPack) {
    return { ok: false, error: "Choose a valid listing credit pack." };
  }
  if (includeGoogleShoppingCredits && !googlePack) {
    return { ok: false, error: "Choose a valid Google Shopping credit pack." };
  }
  if (includePromotionCredits) {
    if (!promotionKind || !PROMOTION_GIFT_KINDS.includes(promotionKind)) {
      return { ok: false, error: "Choose a valid promotion type." };
    }
    if (
      !Number.isFinite(promotionCredits) ||
      promotionCredits < 1 ||
      promotionCredits > MAX_PROMOTION_GIFT_CREDITS
    ) {
      return {
        ok: false,
        error: `Enter promotion credits between 1 and ${MAX_PROMOTION_GIFT_CREDITS}.`,
      };
    }
  }

  const hasAnyGift =
    (listingPack != null && listingPack.credits > 0) ||
    (googlePack != null && googlePack.credits > 0) ||
    (promotionKind != null && promotionCredits > 0) ||
    includeShopFlair;

  if (!hasAnyGift) {
    return {
      ok: false,
      error:
        "Choose at least one gift option (listing credits, promotion credits, Google Shopping credits, or shop flair).",
    };
  }

  return null;
}

function existingShopMerchandiseSubtotalCents(
  options: ReturnType<typeof parseExistingShopGiftOptions>,
): number {
  const promotionSubtotalCents =
    options.promotionKind && options.promotionCredits > 0
      ? promotionPriceCentsForKind(options.promotionKind) * options.promotionCredits
      : 0;

  return (
    (options.listingPack?.priceCents ?? 0) +
    (options.googlePack?.priceCents ?? 0) +
    promotionSubtotalCents +
    (options.includeShopFlair ? SHOP_FLAIR_ACCESS_PRICE_CENTS : 0)
  );
}

function buildExistingShopLineItems(
  options: ReturnType<typeof parseExistingShopGiftOptions>,
  processingLine: ReturnType<typeof stripeCheckoutPaymentProcessingLineItem>,
): CheckoutLineItem[] {
  const lineItems: CheckoutLineItem[] = [];
  const { listingPack, googlePack, promotionKind, promotionCredits, includeShopFlair } = options;

  if (listingPack) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: listingPack.priceCents,
        product_data: {
          name: `${listingPack.credits} listing credits`,
          description: "Gift listing credits for an existing shop.",
        },
      },
    });
  }
  if (googlePack) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: googlePack.priceCents,
        product_data: {
          name: `${googlePack.credits} Google Shopping credits`,
          description: "Gift Google Shopping credits for an existing shop.",
        },
      },
    });
  }
  if (promotionKind && promotionCredits > 0) {
    const unitCents = promotionPriceCentsForKind(promotionKind);
    lineItems.push({
      quantity: promotionCredits,
      price_data: {
        currency: "usd",
        unit_amount: unitCents,
        product_data: {
          name: `${promotionKindLabel(promotionKind)} promotion credit`,
          description: `Gift ${promotionKindLabel(promotionKind).toLowerCase()} placement credit.`,
        },
      },
    });
  }
  if (includeShopFlair) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: SHOP_FLAIR_ACCESS_PRICE_CENTS,
        product_data: {
          name: shopFlairAccessPurchaseLabel(),
          description: "Gift shop flair access for an existing shop.",
        },
      },
    });
  }
  if (processingLine) lineItems.push(processingLine);

  return lineItems;
}

async function markGiftCheckoutFailed(purchaseId: string): Promise<void> {
  await prisma.creatorGiftPurchase.update({
    where: { id: purchaseId },
    data: { status: CreatorGiftPurchaseStatus.failed },
  });
}

/** Setup fee only — emails a redemption code to the purchaser. */
export async function startCreatorGiftCheckout(
  _prev: StartCreatorGiftCheckoutResult | undefined,
  formData: FormData,
): Promise<StartCreatorGiftCheckoutResult> {
  const purchaserEmail = String(formData.get("purchaserEmail") ?? "").trim().toLowerCase();

  if (!purchaserEmail || !purchaserEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email for the gift code." };
  }

  const base = publicAppBaseUrl();
  if (!base) return { ok: false, error: "App URL is not configured." };

  const merchandiseSubtotalCents = SHOP_SETUP_FEE_CENTS;
  const checkoutTotalCents = buyerCheckoutTotalCents(merchandiseSubtotalCents);
  const processingLine = stripeCheckoutPaymentProcessingLineItem({
    subtotalCents: merchandiseSubtotalCents,
  });

  const purchase = await prisma.creatorGiftPurchase.create({
    data: {
      purchaserEmail,
      fulfillmentMode: CreatorGiftFulfillmentMode.email_codes,
      setupFeeIncluded: true,
      amountCents: checkoutTotalCents,
      currency: "usd",
      status: CreatorGiftPurchaseStatus.pending,
    },
    select: { id: true },
  });

  try {
    const appBase = base.replace(/\/$/, "");

    if (isMockCheckoutEnabled()) {
      const mockSessionId = creatorGiftMockSessionId(purchase.id);
      await prisma.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: { stripeCheckoutSessionId: mockSessionId },
      });
      return {
        ok: true,
        url: `${appBase}/gift-creator/success?mode=setup&session_id=${encodeURIComponent(mockSessionId)}`,
      };
    }

    const lineItems: CheckoutLineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: SHOP_SETUP_FEE_CENTS,
          product_data: {
            name: SHOP_SETUP_FEE_LABEL,
            description: "Gift code for a creator's one-time shop setup account fee.",
          },
        },
      },
    ];
    if (processingLine) lineItems.push(processingLine);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: purchaserEmail,
      line_items: lineItems,
      metadata: {
        kind: "creator_gift",
        fulfillmentMode: CreatorGiftFulfillmentMode.email_codes,
        purchaseId: purchase.id,
        setupFeeIncluded: "1",
        subtotalCents: String(merchandiseSubtotalCents),
        amountCents: String(checkoutTotalCents),
      },
      success_url: `${appBase}/gift-creator/success?mode=setup&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/gift-creator?mode=setup&gift=cancel`,
    });

    if (!session.url) {
      await markGiftCheckoutFailed(purchase.id);
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }

    await prisma.creatorGiftPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id },
    });
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[gift-creator] setup checkout failed", e);
    await markGiftCheckoutFailed(purchase.id);
    return { ok: false, error: "Could not start gift checkout. Try again." };
  }
}

/** Direct credits to an existing shop — no redemption codes. */
export async function startCreatorGiftExistingShopCheckout(
  _prev: StartCreatorGiftCheckoutResult | undefined,
  formData: FormData,
): Promise<StartCreatorGiftCheckoutResult> {
  const recipientShopSlug = String(formData.get("recipientShopSlug") ?? "").trim();
  const giftFromName = normalizeGiftFromName(String(formData.get("giftFromName") ?? ""));

  const shopResult = await verifyGiftRecipientShop(recipientShopSlug);
  if (!shopResult.ok) {
    return { ok: false, error: shopResult.error };
  }

  const options = parseExistingShopGiftOptions(formData);
  const validationError = validateExistingShopGiftOptions(options);
  if (validationError) return validationError;

  const shopDetail = await prisma.shop.findUnique({
    where: { id: shopResult.shop.id },
    select: { flairPurchasedAt: true },
  });
  if (options.includeShopFlair && shopDetail?.flairPurchasedAt) {
    return { ok: false, error: "That shop already has shop flair access." };
  }

  const base = publicAppBaseUrl();
  if (!base) return { ok: false, error: "App URL is not configured." };

  const merchandiseSubtotalCents = existingShopMerchandiseSubtotalCents(options);
  if (merchandiseSubtotalCents <= 0) {
    return { ok: false, error: "Gift amount must be greater than $0." };
  }

  const checkoutTotalCents = buyerCheckoutTotalCents(merchandiseSubtotalCents);
  const processingLine = stripeCheckoutPaymentProcessingLineItem({
    subtotalCents: merchandiseSubtotalCents,
  });
  const { listingPack, googlePack, promotionKind, promotionCredits, includeShopFlair } = options;

  const purchase = await prisma.creatorGiftPurchase.create({
    data: {
      purchaserEmail: null,
      fulfillmentMode: CreatorGiftFulfillmentMode.direct_to_shop,
      recipientShopId: shopResult.shop.id,
      giftFromName,
      setupFeeIncluded: false,
      shopFlairIncluded: includeShopFlair,
      listingCreditPackId: listingPack?.id ?? null,
      listingCreditsGranted: listingPack?.credits ?? 0,
      googleShoppingCreditPackId: googlePack?.id ?? null,
      googleShoppingCreditsGranted: googlePack?.credits ?? 0,
      promotionKind: promotionKind ?? null,
      promotionCreditsGranted: promotionKind && promotionCredits > 0 ? promotionCredits : 0,
      amountCents: checkoutTotalCents,
      currency: "usd",
      status: CreatorGiftPurchaseStatus.pending,
    },
    select: { id: true },
  });

  try {
    const appBase = base.replace(/\/$/, "");

    if (isMockCheckoutEnabled()) {
      const mockSessionId = creatorGiftMockSessionId(purchase.id);
      await prisma.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: { stripeCheckoutSessionId: mockSessionId },
      });
      return {
        ok: true,
        url: `${appBase}/gift-creator/success?mode=direct&shop=${encodeURIComponent(shopResult.shop.slug)}&session_id=${encodeURIComponent(mockSessionId)}`,
      };
    }

    const lineItems = buildExistingShopLineItems(options, processingLine);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      metadata: {
        kind: "creator_gift",
        fulfillmentMode: CreatorGiftFulfillmentMode.direct_to_shop,
        purchaseId: purchase.id,
        recipientShopId: shopResult.shop.id,
        recipientShopSlug: shopResult.shop.slug,
        giftFromName: giftFromName ?? "",
        listingCreditPackId: listingPack?.id ?? "",
        listingCreditsGranted: String(listingPack?.credits ?? 0),
        googleShoppingCreditPackId: googlePack?.id ?? "",
        googleShoppingCreditsGranted: String(googlePack?.credits ?? 0),
        promotionKind: promotionKind ?? "",
        promotionCreditsGranted: String(promotionCredits > 0 ? promotionCredits : 0),
        shopFlairIncluded: includeShopFlair ? "1" : "0",
        subtotalCents: String(merchandiseSubtotalCents),
        amountCents: String(checkoutTotalCents),
      },
      success_url: `${appBase}/gift-creator/success?mode=direct&shop=${encodeURIComponent(shopResult.shop.slug)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/gift-creator?mode=existing&gift=cancel`,
    });

    if (!session.url) {
      await markGiftCheckoutFailed(purchase.id);
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }

    await prisma.creatorGiftPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id },
    });
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[gift-creator] existing-shop checkout failed", e);
    await markGiftCheckoutFailed(purchase.id);
    return { ok: false, error: "Could not start gift checkout. Try again." };
  }
}
