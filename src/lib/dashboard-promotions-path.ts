import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** Creator shop upgrades page ({@link DASHBOARD_PROMOTIONS_PATH}). */
export const DASHBOARD_SHOP_UPGRADES_LABEL = "Shop Upgrades";

/**
 * Standalone dashboard page for shop upgrades (not a `?dash=` tab).
 * Paid checkouts roll into admin Platform sales Listings or Promotions
 * ({@link aggregateShopUpgradesPlatformRevenue}).
 */
export const DASHBOARD_PROMOTIONS_PATH = "/dashboard/shop-upgrades";

/** Permanent redirect target for bookmarks to `/dashboard/promotions`. */
export const DASHBOARD_LEGACY_PROMOTIONS_PATH = "/dashboard/promotions";

/** Open or close checkout for a placement kind (`?buy=`). Preserves e.g. `history`, `promo`. */
export function dashboardPromotionsBuyUrl(
  kind: PlacementCheckoutPromotionKind,
  selectedKind: PlacementCheckoutPromotionKind | null | undefined,
  preserve?: Record<string, string | undefined>,
): string {
  if (selectedKind === kind) {
    const { buy: _buy, period: _period, ...rest } = preserve ?? {};
    return dashboardPromotionsUrl(rest);
  }
  const { period: _period, ...rest } = preserve ?? {};
  return dashboardPromotionsUrl({ ...rest, buy: kind });
}

/** Same-page checkout URL with placement period selected. */
export function dashboardPromotionsCheckoutPeriodUrl(
  kind: PlacementCheckoutPromotionKind,
  offset: 0 | 1 | 2,
  preserve?: Record<string, string | undefined>,
): string {
  return dashboardPromotionsUrl({ ...preserve, buy: kind, period: String(offset) });
}

export function dashboardPromotionsUrl(query?: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v.length > 0) p.set(k, v);
    }
  }
  const q = p.toString();
  return q ? `${DASHBOARD_PROMOTIONS_PATH}?${q}` : DASHBOARD_PROMOTIONS_PATH;
}
