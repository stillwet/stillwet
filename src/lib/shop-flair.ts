/** One-time shop flair access purchase (badge type picker on storefront). */
export const SHOP_FLAIR_ACCESS_PRICE_CENTS = 500;

export function shopFlairAccessPriceUsdLabel(): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(SHOP_FLAIR_ACCESS_PRICE_CENTS / 100);
}

/** Verify-purchase dialog and payment summary copy. */
export function shopFlairAccessPurchaseLabel(): string {
  return `Shop flair — ${shopFlairAccessPriceUsdLabel()}`;
}

/** Compact pack button on shop upgrades. */
export function shopFlairAccessBuyButtonLabel(): string {
  const dollars = Math.round(SHOP_FLAIR_ACCESS_PRICE_CENTS / 100);
  return `Buy Flair - $${dollars}`;
}

/** Synthetic `kind` on dashboard purchase-history rows for flair access payments. */
export const SHOP_FLAIR_PURCHASE_HISTORY_KIND = "SHOP_FLAIR_ACCESS";

export function shopFlairPurchaseHistoryLabel(): string {
  return "Shop flair access";
}

export function isShopFlairPurchaseHistoryRow(row: {
  purchaseType?: string;
  kind: string;
}): boolean {
  return (
    row.purchaseType === "shop_flair" || row.kind === SHOP_FLAIR_PURCHASE_HISTORY_KIND
  );
}
