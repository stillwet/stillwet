import type { DashboardPromotionsTabSummaryPayload } from "@/lib/dashboard-promotions-tab-types";
import type { DashboardPromotionsCheckoutEnv } from "@/lib/dashboard-promotions-checkout-env";

export function buildPromotionsCheckoutSummary(
  initialSummary: DashboardPromotionsTabSummaryPayload | null | undefined,
  checkoutEnv: DashboardPromotionsCheckoutEnv | undefined,
): DashboardPromotionsTabSummaryPayload | null {
  if (checkoutEnv == null) return null;
  if (initialSummary != null) {
    return { ...initialSummary, mockPromotionCheckout: checkoutEnv.mockPromotionCheckout };
  }
  return {
    purchases: [],
    mockPromotionCheckout: checkoutEnv.mockPromotionCheckout,
    stripePublishableKey: checkoutEnv.stripePublishableKey,
    promotionCreditBalances: checkoutEnv.promotionCreditBalances ?? {},
  };
}
