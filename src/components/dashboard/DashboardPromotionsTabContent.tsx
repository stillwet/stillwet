import { PromotionsTabClientBody } from "@/components/dashboard/PromotionsTabClientBody";
import { PromotionsTabPanel } from "@/components/dashboard/PromotionsTabPanel";
import type { DashboardPromotionsTabSummaryPayload } from "@/lib/dashboard-scoped-data";

/** Fallback while the Promotions tab subtree resolves (fast shell). */
export function PromotionsPanelSkeleton() {
  return (
    <div className="flex min-h-[12rem] items-center gap-2 py-10 text-sm text-zinc-500">
      <span
        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
        aria-hidden
      />
      Loading shop upgrades…
    </div>
  );
}

/**
 * RSC fast path: {@link PromotionsTabPanel} (no client fetch). Rare fallback: client fetch when no server payload.
 */
export function DashboardPromotionsTabContent({
  initialSummary,
}: {
  initialSummary?: DashboardPromotionsTabSummaryPayload | null;
} = {}) {
  if (initialSummary != null) {
    return <PromotionsTabPanel summary={initialSummary} />;
  }
  return <PromotionsTabClientBody initialSummary={null} />;
}
