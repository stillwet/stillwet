import { ListingsTabExpandSection } from "@/components/dashboard/ListingsTabExpandSection";
import { PromotionsTabInteractive } from "@/components/dashboard/PromotionsTabInteractive";
import {
  PromotionsTabFooterParagraph,
  PromotionsTabIntroParagraph,
} from "@/components/dashboard/promotions-tab-dashboard-intro";
import type { DashboardPromotionsTabSummaryPayload } from "@/lib/dashboard-promotions-tab-types";

/**
 * RSC shell for the shop Promotions tab: collapsible header + explainer copy stream as HTML; only the
 * interactive block hydrates on the client ({@link PromotionsTabInteractive}).
 */
export function PromotionsTabPanel({ summary }: { summary: DashboardPromotionsTabSummaryPayload }) {
  const paidCount = (summary.purchases ?? []).filter((p) => p.status === "paid").length;

  return (
    <ListingsTabExpandSection
      className="mt-6"
      title="Promoted"
      titleClassName="text-violet-400/95"
      badgeCount={paidCount > 0 ? paidCount : undefined}
      blurb="Paid promotions"
      collapsible={false}
    >
      <PromotionsTabFooterParagraph />
      <PromotionsTabIntroParagraph />
      <PromotionsTabInteractive initialSummary={summary} />
    </ListingsTabExpandSection>
  );
}
