import { PromotionsPurchaseHistoryLazy } from "@/components/dashboard/promotions/PromotionsPurchaseHistoryLazy";

/** Server wrapper — client history chunk mounts only when `?history=1`. */
export function PromotionsHistoryExpanded() {
  return (
    <details open className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/25">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-medium text-zinc-400 [&::-webkit-details-marker]:hidden">
        Purchase history
      </summary>
      <div className="border-t border-zinc-800/80 px-4 pb-4 pt-2">
        <PromotionsPurchaseHistoryLazy />
      </div>
    </details>
  );
}
