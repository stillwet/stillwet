import { loadPromotionsSummaryForShop } from "@/lib/dashboard-scoped-data";
import { DashboardPromotionsTabContent } from "@/components/dashboard/DashboardPromotionsTabContent";

/**
 * Async RSC leaf: purchase history only. Slot pricing prefetches on the client after paint
 * ({@link PromotionsTabInteractive}) so this boundary does not block the dev server or tab shell.
 */
export async function DashboardPromotionsRscPayload({
  shopId,
  shopSlug,
}: {
  shopId: string;
  shopSlug: string;
}) {
  const summary = await loadPromotionsSummaryForShop(shopId, shopSlug);
  return <DashboardPromotionsTabContent initialSummary={summary} />;
}
