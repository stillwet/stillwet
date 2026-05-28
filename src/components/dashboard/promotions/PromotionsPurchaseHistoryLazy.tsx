"use client";

import dynamic from "next/dynamic";

const PromotionsPurchaseHistorySection = dynamic(
  () =>
    import("@/components/dashboard/PromotionsPurchaseHistorySection").then((m) => ({
      default: m.PromotionsPurchaseHistorySection,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="flex items-center gap-2 text-xs text-zinc-500" aria-busy="true">
        <span
          className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
          aria-hidden
        />
        Loading history…
      </p>
    ),
  },
);

export function PromotionsPurchaseHistoryLazy() {
  return <PromotionsPurchaseHistorySection embedded />;
}
