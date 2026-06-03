/**
 * Dashboard “simulate demo purchase” (fake paid order). Allowed only under `next dev`
 * with `SHOP_DEMO_PURCHASE_BUTTON=1` and an active `/admin` session — never in production.
 */
export function shopDemoPurchaseFeatureEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.SHOP_DEMO_PURCHASE_BUTTON === "1"
  );
}
