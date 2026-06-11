"use server";

import { CreatorGiftFulfillmentMode, CreatorGiftPurchaseStatus } from "@/generated/prisma/enums";
import type { PromotionKind } from "@/generated/prisma/enums";
import { verifyGiftRecipientShop } from "@/actions/gift-creator-shop-search";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { SHOP_SETUP_FEE_CENTS } from "@/lib/creator-gift-codes";
import { creatorGiftMockSessionId } from "@/lib/creator-gift-mock-checkout";
import { normalizeGiftFromName } from "@/lib/creator-gift-notices";
import {
  type CreatorGiftPromotionGrantLine,
  legacyPromotionFieldsFromGrants,
  parsePromotionGrantsFromFormData,
  validatePromotionGrants,
} from "@/lib/creator-gift-promotion-grants";
import { existingShopGiftMerchandiseSubtotalCents } from "@/lib/creator-gift-existing-shop-merchandise";
import { googleShoppingCreditPackById } from "@/lib/google-shopping-credit-packs";
import { listingCreditPackById } from "@/lib/listing-credit-packs";
import { prisma } from "@/lib/prisma";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import {
  PLATFORM_TRANSACTION_PRODUCT,
  allocatePlatformOrderNumber,
  formatMultipleGiftsTransactionReference,
  promotionKindToPlatformTransactionProduct,
  stripePlatformTransactionReferenceFields,
  type PlatformTransactionProduct,
} from "@/lib/platform-transaction-reference";
import {
  SHOP_FLAIR_ACCESS_PRICE_CENTS,
} from "@/lib/shop-flair";
import {
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

  const promotionGrants = includePromotionCredits
    ? parsePromotionGrantsFromFormData(formData)
    : [];

  return {
    includeListingCredits,
    includePromotionCredits,
    includeGoogleShoppingCredits,
    includeShopFlair,
    listingPack,
    googlePack,
    promotionGrants,
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
    promotionGrants,
  } = options;

  if (includeListingCredits && !listingPack) {
    return { ok: false, error: "Choose a valid listing credit pack." };
  }
  if (includeGoogleShoppingCredits && !googlePack) {
    return { ok: false, error: "Choose a valid Google Shopping credit pack." };
  }

  const promotionError = validatePromotionGrants(promotionGrants, includePromotionCredits);
  if (promotionError) {
    return { ok: false, error: promotionError };
  }

  const hasAnyGift =
    (listingPack != null && listingPack.credits > 0) ||
    (googlePack != null && googlePack.credits > 0) ||
    promotionGrants.length > 0 ||
    includeShopFlair;

  if (!hasAnyGift) {
    return {
      ok: false,
      error:
        "Choose at least one gift option (listing credits, upgrade credits, Google Shopping credits, or shop flair).",
    };
  }

  return null;
}

function existingShopMerchandiseSubtotalCents(
  options: ReturnType<typeof parseExistingShopGiftOptions>,
): number {
  return existingShopGiftMerchandiseSubtotalCents({
    listingPackPriceCents: options.listingPack?.priceCents ?? 0,
    googlePackPriceCents: options.googlePack?.priceCents ?? 0,
    promotionGrants: options.promotionGrants,
    includeShopFlair: options.includeShopFlair,
  });
}

async function createPendingExistingShopGiftPurchase(args: {
  recipientShopId: string;
  giftFromName: string | null;
  includeShopFlair: boolean;
  listingPack: ReturnType<typeof parseExistingShopGiftOptions>["listingPack"];
  googlePack: ReturnType<typeof parseExistingShopGiftOptions>["googlePack"];
  legacyPromotion: ReturnType<typeof legacyPromotionFieldsFromGrants>;
  checkoutTotalCents: number;
  primaryTransactionNumber: number | null;
  promotionGrants: CreatorGiftPromotionGrantLine[];
}): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.creatorGiftPurchase.create({
      data: {
        purchaserEmail: null,
        fulfillmentMode: CreatorGiftFulfillmentMode.direct_to_shop,
        recipientShopId: args.recipientShopId,
        giftFromName: args.giftFromName,
        setupFeeIncluded: false,
        shopFlairIncluded: args.includeShopFlair,
        listingCreditPackId: args.listingPack?.id ?? null,
        listingCreditsGranted: args.listingPack?.credits ?? 0,
        googleShoppingCreditPackId: args.googlePack?.id ?? null,
        googleShoppingCreditsGranted: args.googlePack?.credits ?? 0,
        promotionKind: args.legacyPromotion.promotionKind,
        promotionCreditsGranted: args.legacyPromotion.promotionCreditsGranted,
        amountCents: args.checkoutTotalCents,
        currency: "usd",
        status: CreatorGiftPurchaseStatus.pending,
        transactionNumber: args.primaryTransactionNumber,
      },
      select: { id: true },
    });

    if (args.promotionGrants.length > 0) {
      await tx.creatorGiftPromotionGrant.createMany({
        data: args.promotionGrants.map((grant) => ({
          purchaseId: purchase.id,
          kind: grant.kind,
          credits: grant.credits,
        })),
      });
    }

    return purchase;
  });
}

type ExistingShopGiftLineLabels = {
  listingCredits?: string;
  googleShopping?: string;
  promotionByKind: Partial<Record<PromotionKind, string>>;
  shopFlair?: string;
};

function buildExistingShopLineItems(
  options: ReturnType<typeof parseExistingShopGiftOptions>,
  processingLine: ReturnType<typeof stripeCheckoutPaymentProcessingLineItem>,
  lineLabels: ExistingShopGiftLineLabels,
): CheckoutLineItem[] {
  const lineItems: CheckoutLineItem[] = [];
  const { listingPack, googlePack, promotionGrants, includeShopFlair } = options;

  if (listingPack && lineLabels.listingCredits) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: listingPack.priceCents,
        product_data: {
          name: lineLabels.listingCredits,
          description: "Gift listing credits for an existing shop.",
        },
      },
    });
  }
  if (googlePack && lineLabels.googleShopping) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: googlePack.priceCents,
        product_data: {
          name: lineLabels.googleShopping,
          description: "Gift Google Shopping credits for an existing shop.",
        },
      },
    });
  }
  for (const grant of promotionGrants) {
    const label = lineLabels.promotionByKind[grant.kind];
    if (!label) continue;
    const unitCents = promotionPriceCentsForKind(grant.kind);
    lineItems.push({
      quantity: grant.credits,
      price_data: {
        currency: "usd",
        unit_amount: unitCents,
        product_data: {
          name: label,
          description: `Gift ${promotionKindLabel(grant.kind).toLowerCase()} placement credit.`,
        },
      },
    });
  }
  if (includeShopFlair && lineLabels.shopFlair) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: SHOP_FLAIR_ACCESS_PRICE_CENTS,
        product_data: {
          name: lineLabels.shopFlair,
          description: "Gift shop flair access for an existing shop.",
        },
      },
    });
  }
  if (processingLine) lineItems.push(processingLine);

  return lineItems;
}

function existingShopGiftCategoryCount(
  options: ReturnType<typeof parseExistingShopGiftOptions>,
): number {
  let count = 0;
  if (options.listingPack) count += 1;
  if (options.googlePack) count += 1;
  count += options.promotionGrants.length;
  if (options.includeShopFlair) count += 1;
  return count;
}

async function allocateExistingShopGiftLineLabels(
  options: ReturnType<typeof parseExistingShopGiftOptions>,
): Promise<{ lineLabels: ExistingShopGiftLineLabels; primaryTransactionNumber: number | null }> {
  return prisma.$transaction(async (tx) => {
    const lineLabels: ExistingShopGiftLineLabels = { promotionByKind: {} };
    const categoryCount = existingShopGiftCategoryCount(options);
    const primaryTransactionNumber = await allocatePlatformOrderNumber(tx);
    const multipleGiftsLabel = formatMultipleGiftsTransactionReference(primaryTransactionNumber);

    const giftLineLabel = (product: PlatformTransactionProduct) => {
      if (categoryCount > 1) return multipleGiftsLabel;
      return stripePlatformTransactionReferenceFields(product, primaryTransactionNumber, {
        gift: true,
      }).lineItemName;
    };

    if (options.listingPack) {
      lineLabels.listingCredits = giftLineLabel(PLATFORM_TRANSACTION_PRODUCT.listing_credits);
    }
    if (options.googlePack) {
      lineLabels.googleShopping = giftLineLabel(
        PLATFORM_TRANSACTION_PRODUCT.gshop_listing_upgrade,
      );
    }
    for (const grant of options.promotionGrants) {
      lineLabels.promotionByKind[grant.kind] = giftLineLabel(
        promotionKindToPlatformTransactionProduct(grant.kind),
      );
    }
    if (options.includeShopFlair) {
      lineLabels.shopFlair = giftLineLabel(PLATFORM_TRANSACTION_PRODUCT.shop_flair);
    }

    return { lineLabels, primaryTransactionNumber };
  });
}

async function markGiftCheckoutFailed(purchaseId: string): Promise<void> {
  await prisma.creatorGiftPurchase.update({
    where: { id: purchaseId },
    data: { status: CreatorGiftPurchaseStatus.failed },
  });
}

function serializePromotionGrantsMetadata(grants: CreatorGiftPromotionGrantLine[]): string {
  return JSON.stringify(grants.map((g) => ({ kind: g.kind, credits: g.credits })));
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

  const { purchaseId, refFields } = await prisma.$transaction(async (tx) => {
    const transactionNumber = await allocatePlatformOrderNumber(tx);
    const fields = stripePlatformTransactionReferenceFields(
      PLATFORM_TRANSACTION_PRODUCT.shop_creation_fee,
      transactionNumber,
      { gift: true },
    );
    const purchase = await tx.creatorGiftPurchase.create({
      data: {
        purchaserEmail,
        fulfillmentMode: CreatorGiftFulfillmentMode.email_codes,
        setupFeeIncluded: true,
        amountCents: checkoutTotalCents,
        currency: "usd",
        status: CreatorGiftPurchaseStatus.pending,
        transactionNumber,
      },
      select: { id: true },
    });
    return { purchaseId: purchase.id, refFields: fields };
  });

  try {
    const appBase = base.replace(/\/$/, "");

    if (isMockCheckoutEnabled()) {
      const mockSessionId = creatorGiftMockSessionId(purchaseId);
      await prisma.creatorGiftPurchase.update({
        where: { id: purchaseId },
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
            name: refFields.lineItemName,
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
        purchaseId,
        setupFeeIncluded: "1",
        subtotalCents: String(merchandiseSubtotalCents),
        amountCents: String(checkoutTotalCents),
        ...refFields.metadata,
      },
      payment_intent_data: {
        description: refFields.description,
        metadata: refFields.metadata,
      },
      success_url: `${appBase}/gift-creator/success?mode=setup&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/gift-creator?mode=setup&gift=cancel`,
    });

    if (!session.url) {
      await markGiftCheckoutFailed(purchaseId);
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }

    await prisma.creatorGiftPurchase.update({
      where: { id: purchaseId },
      data: { stripeCheckoutSessionId: session.id },
    });
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[gift-creator] setup checkout failed", e);
    await markGiftCheckoutFailed(purchaseId);
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
  const { listingPack, googlePack, promotionGrants, includeShopFlair } = options;
  const legacyPromotion = legacyPromotionFieldsFromGrants(promotionGrants);

  const { lineLabels, primaryTransactionNumber } = await allocateExistingShopGiftLineLabels(options);
  const piDescription =
    existingShopGiftCategoryCount(options) > 1 && primaryTransactionNumber != null
      ? formatMultipleGiftsTransactionReference(primaryTransactionNumber)
      : (lineLabels.listingCredits ??
        lineLabels.googleShopping ??
        Object.values(lineLabels.promotionByKind)[0] ??
        lineLabels.shopFlair ??
        "Creator gift");

  const purchase = await createPendingExistingShopGiftPurchase({
    recipientShopId: shopResult.shop.id,
    giftFromName,
    includeShopFlair,
    listingPack,
    googlePack,
    legacyPromotion,
    checkoutTotalCents,
    primaryTransactionNumber,
    promotionGrants,
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

    const lineItems = buildExistingShopLineItems(options, processingLine, lineLabels);

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
        promotionGrantsJson: serializePromotionGrantsMetadata(promotionGrants),
        promotionKind: legacyPromotion.promotionKind ?? "",
        promotionCreditsGranted: String(legacyPromotion.promotionCreditsGranted),
        shopFlairIncluded: includeShopFlair ? "1" : "0",
        subtotalCents: String(merchandiseSubtotalCents),
        amountCents: String(checkoutTotalCents),
        platformTransactionGift: "1",
      },
      payment_intent_data: {
        description: piDescription,
        metadata: { platformTransactionGift: "1" },
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
