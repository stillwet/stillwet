/** Client-safe types and pure helpers for Platform sales merged lines (no Prisma / Node imports). */

import {
  buyerCheckoutTotalCents,
} from "@/lib/stripe-card-processing-fee";

export type AdminPlatformSalesBuyer = {
  email: string | null;
  shippingState: string | null;
  shippingCountry: string | null;
};

/** Row filters for the Platform sales lines table. */
export type AdminPlatformSaleCategory =
  | "listing"
  | "item"
  | "support"
  | "promotion"
  | "shop_creation";

type PlatformCheckoutMergedLineBase = {
  quantity: number;
  unitPriceCents: number;
  productName: string;
  /** Buyer-paid checkout total for this row (pre–sales-tax). */
  checkoutTotalCents: number;
  /** Merchandise or platform service price before tip and processing. */
  itemPriceCents: number;
  /** Cart tip allocated to this row. */
  tipCents: number;
  goodsServicesCostCents: number;
  productionFeeCents: number;
  platformCutCents: number;
  shopCutCents: number;
  /** Stripe balance fee on this row's share of the checkout total (merchandise) or full card charge (platform checkout). */
  stripeFeeCents: number;
  /** 25¢ cart-tip platform surcharge on buyer item checkouts (0 elsewhere). */
  tipProcessingFeeCents: number;
  order: { id: string; createdAt: Date; orderNumber: number | null };
  shop: { displayName: string; slug: string } | null;
  /** Checkout email when there is no purchasing shop row (gifts, pre-shop signup). */
  transactionEmail: string | null;
  itemHref: string | null;
  /** Listing + promotion creator gift on one checkout: primary vs profit-only row. */
  creatorGiftSplitPart?: "listing" | "promotion";
};

export type AdminPlatformSalesMergedLine =
  | {
      kind: "merchandise";
      platformSaleCategory: "item";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      productionFeeCents: number;
      platformCutCents: number;
      shopCutCents: number;
      checkoutTotalCents: number;
      itemPriceCents: number;
      tipCents: number;
      /** Estimated Stripe balance fee on this row's share of the checkout total. */
      stripeFeeCents: number;
      /** 25¢ cart-tip processing surcharge allocated to this row (0 when no tip). */
      tipProcessingFeeCents: number;
      order: { id: string; createdAt: Date; orderNumber: number };
      shop: { displayName: string; slug: string } | null;
      buyer: AdminPlatformSalesBuyer;
      itemHref: string | null;
    }
  | ({
      kind: "listing_credit_pack_purchase";
      platformSaleCategory: "listing";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "support_tip";
      platformSaleCategory: "support";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "promotion_purchase";
      platformSaleCategory: "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_setup_fee_purchase";
      platformSaleCategory: "shop_creation";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_reactivation_purchase";
      platformSaleCategory: "shop_creation";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_flair_purchase";
      platformSaleCategory: "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_google_shopping_purchase";
      platformSaleCategory: "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "creator_gift_purchase";
      platformSaleCategory: "shop_creation" | "listing" | "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase);

/** Platform checkout rows (not buyer merchandise lines). Merch / G/S columns show —. */
export function isPlatformCheckoutMergedLine(l: AdminPlatformSalesMergedLine): boolean {
  return l.kind !== "merchandise";
}

/** Shop display name for shop checkouts, otherwise the transaction email. */
export function mergedLineTransactionPartyLabel(l: AdminPlatformSalesMergedLine): string {
  if (l.kind === "merchandise") {
    return l.buyer.email?.trim() || "—";
  }
  if (l.kind === "creator_gift_purchase") {
    return l.transactionEmail?.trim() || "—";
  }
  const shopName = l.shop?.displayName?.trim();
  if (shopName) return shopName;
  return l.transactionEmail?.trim() || "—";
}

/** Full card charge for platform checkout rows (infers processing when stored amount is merch-only). */
export function platformCheckoutFullChargeCents(line: {
  checkoutTotalCents: number;
  itemPriceCents: number;
}): number {
  const stored = Math.max(0, line.checkoutTotalCents);
  const merchandiseCents = Math.max(0, line.itemPriceCents);
  if (merchandiseCents <= 0) return stored;
  if (stored === merchandiseCents) return buyerCheckoutTotalCents(merchandiseCents);
  return stored;
}

/** Listing + promotion creator gift split: profit-only listing row label. */
export const CREATOR_GIFT_LISTING_SPLIT_LABEL = "Multiple - Listings Split";

/** Creator gift listing row in a listing + promotion split (no paid / Stripe in popup). */
export function isCreatorGiftListingSplitProfitOnlyLine(l: AdminPlatformSalesMergedLine): boolean {
  return l.kind === "creator_gift_purchase" && l.creatorGiftSplitPart === "listing";
}

/** Buyer-paid checkout total for this row (service price + Stripe fee on platform checkouts). */
export function mergedLineCheckoutPaidCents(l: AdminPlatformSalesMergedLine): number {
  if (l.kind === "merchandise") return l.checkoutTotalCents;
  if (isCreatorGiftListingSplitProfitOnlyLine(l)) return 0;
  const fullCharge = platformCheckoutFullChargeCents(l);
  const decomposed = l.itemPriceCents + mergedLineStripeBalanceFeeCents(l);
  return Math.max(fullCharge, decomposed);
}

/** Stripe balance fee (2.9% + 30¢ on full charge) — admin reconciliation, not buyer pass-through. */
export function mergedLineStripeBalanceFeeCents(l: AdminPlatformSalesMergedLine): number {
  if (l.kind === "merchandise") return l.stripeFeeCents;
  if (isCreatorGiftListingSplitProfitOnlyLine(l)) return 0;
  return l.stripeFeeCents;
}

/** Merchandise shop payout: line shop cut + allocated cart tip. */
export function mergedLineShopPayoutCents(l: AdminPlatformSalesMergedLine): number {
  if (l.kind !== "merchandise") return 0;
  return l.shopCutCents + Math.max(0, l.tipCents);
}

/**
 * Buyer payment-processing pass-through on a merchandise row (in Stripe application fee).
 * `Paid − merchandise − tip` for the row's allocated checkout share.
 */
export function mergedLineBuyerPaymentProcessingPassThroughCents(
  l: AdminPlatformSalesMergedLine,
): number {
  if (l.kind !== "merchandise") return 0;
  const paid = mergedLineCheckoutPaidCents(l);
  const merch = Math.max(0, l.itemPriceCents);
  const tip = Math.max(0, l.tipCents);
  return Math.max(0, paid - merch - tip);
}

/**
 * Merchandise Connect application amount (platform share before COGS breakdown):
 * buyer Paid − Shop payout. Matches Stripe `application_fee_amount` + shipping retained
 * on the platform account; Stripe balance fees are separate.
 */
export function mergedLineApplicationAmountCents(l: AdminPlatformSalesMergedLine): number {
  if (l.kind !== "merchandise") return 0;
  return mergedLineCheckoutPaidCents(l) - mergedLineShopPayoutCents(l);
}

/** Per-row shop/platform checkout breakdown header: Paid − Shop payout − COGS − Stripe balance fee. */
export function mergedLinePaidCogsStripeNetCents(l: AdminPlatformSalesMergedLine): number {
  if (l.kind === "creator_gift_purchase" && l.creatorGiftSplitPart) {
    return l.platformCutCents;
  }
  let net = mergedLineCheckoutPaidCents(l) - mergedLineStripeBalanceFeeCents(l);
  if (l.kind === "merchandise") {
    net -= mergedLineShopPayoutCents(l) + l.goodsServicesCostCents;
  }
  return net;
}

/** Details popup / CSV export — same cents as the per-row breakdown table. */
export function mergedLineDetailsExport(l: AdminPlatformSalesMergedLine) {
  return {
    platformProfitCents: mergedLinePaidCogsStripeNetCents(l),
    paidCents: mergedLineCheckoutPaidCents(l),
    shopCutCents: l.kind === "merchandise" ? l.shopCutCents : 0,
    cogsCents: l.kind === "merchandise" ? l.goodsServicesCostCents : 0,
    stripeBalanceFeeCents: mergedLineStripeBalanceFeeCents(l),
    platformCutCents: l.kind === "merchandise" ? l.platformCutCents : 0,
    productionFeeCents: l.kind === "merchandise" ? l.productionFeeCents : 0,
    tipProcessingFeeCents: l.tipProcessingFeeCents,
  };
}
