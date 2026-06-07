import { SHOP_NOT_LIVE_CONNECT_MESSAGE } from "@/lib/shop-stripe-connect-gate";

export function ShopConnectNotLiveBanner() {
  return (
    <div
      role="status"
      className="mb-8 rounded-lg border border-blue-500/40 bg-blue-950/50 px-4 py-3 text-center sm:px-5 sm:py-4"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300 sm:text-sm">
        Preview mode
      </p>
      <p className="mt-1.5 text-sm font-medium leading-snug text-blue-100 sm:text-base">
        {SHOP_NOT_LIVE_CONNECT_MESSAGE}
      </p>
    </div>
  );
}
