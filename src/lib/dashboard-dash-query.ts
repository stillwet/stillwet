import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";

/**
 * Legacy `?dash=` value that previously opened shop upgrades on the dashboard.
 * Bookmarks and Stripe redirects may still use it — redirect to {@link DASHBOARD_PROMOTIONS_PATH}.
 */
export const DASH_QUERY_LISTING_BOOSTS = "listingBoosts";

/** Whether `?dash=` refers to the old in-dashboard upgrades tab (now `/dashboard/shop-upgrades`). */
export function isLegacyDashboardPromotionsDashParam(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw === DASH_QUERY_LISTING_BOOSTS || raw === "promotions";
}

/** Normalize `dash` query from the URL to the canonical tab identifier used server-side / in scopes. */
export function dashboardTabParamToId(raw: string | undefined): string | undefined {
  return raw;
}

/** Emit the `dash` query value for dashboard tab links. */
export function dashQueryParamForTabId(id: DashboardMainTabId): string {
  return id;
}
