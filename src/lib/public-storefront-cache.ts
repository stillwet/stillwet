export const PUBLIC_STOREFRONT_CACHE_TAG = "public-storefront";
export const PUBLIC_STOREFRONT_REVALIDATE_SECONDS = 10 * 60;
/** Browse text search (`?q=`) — stale results acceptable per product tier (~hourly). */
export const SHOP_BROWSE_SEARCH_REVALIDATE_SECONDS = 60 * 60;

export function publicProductCacheTag(productSlug: string) {
  return `public-product:${productSlug}`;
}

export function publicShopCacheTag(shopSlug: string) {
  return `public-shop:${shopSlug}`;
}
