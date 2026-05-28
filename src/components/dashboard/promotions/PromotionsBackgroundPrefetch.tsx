"use client";

import dynamic from "next/dynamic";

const PromotionsPrefetchCoordinator = dynamic(
  () =>
    import("@/components/dashboard/promotions/PromotionsPrefetchCoordinator").then((m) => ({
      default: m.PromotionsPrefetchCoordinator,
    })),
  { ssr: false },
);

/** Lazy coordinator shell — keeps dashboard layout JS minimal until hydrated. */
export function PromotionsBackgroundPrefetch() {
  return <PromotionsPrefetchCoordinator />;
}
