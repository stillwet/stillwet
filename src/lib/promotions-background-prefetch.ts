import { DASHBOARD_PROMOTIONS_PATH } from "@/lib/dashboard-promotions-path";
import { prefetchPromotionPayChunk } from "@/lib/promotion-checkout-prefetch";

/**
 * Idle dashboard prefetch of `/dashboard/shop-upgrades` (off in production by default to save Vercel CPU).
 * Set `NEXT_PUBLIC_PROMOTIONS_IDLE_PREFETCH=1` to enable in production builds.
 */
export function isDashboardPromotionsIdlePrefetchEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PROMOTIONS_IDLE_PREFETCH === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/** Skip background work on slow connections / data-saver. */
export function shouldBackgroundPrefetchPromotions(): boolean {
  if (!isDashboardPromotionsIdlePrefetchEnabled()) return false;
  if (typeof navigator === "undefined") return false;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (conn?.saveData) return false;
  const t = conn?.effectiveType;
  if (t === "slow-2g" || t === "2g") return false;
  return true;
}

export function isPromotionsPrefetchSkippedPath(pathname: string): boolean {
  if (pathname.startsWith(DASHBOARD_PROMOTIONS_PATH)) return true;
  if (pathname.startsWith("/dashboard/login")) return true;
  return false;
}

/** Pay chunk only on dashboard idle (history loads when purchase history is expanded). */
export function prefetchPromotionOptionalChunks(): void {
  if (typeof window === "undefined") return;
  prefetchPromotionPayChunk();
}
