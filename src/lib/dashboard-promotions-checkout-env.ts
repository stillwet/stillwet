/** Client-safe promotion checkout flags (no Prisma). */
import type { PromotionCheckoutSlotsByKind } from "@/lib/dashboard-promotions-payload-types";

export type DashboardPromotionsCheckoutEnv = {
  mockPromotionCheckout: boolean;
  stripePublishableKey: string | null;
  /** Formula period labels + amounts (no DB); set on the server for instant tab open. */
  periodSlotUiByKind?: PromotionCheckoutSlotsByKind;
};

export function emptyPromotionsSummaryWithCheckoutEnv(
  env: DashboardPromotionsCheckoutEnv & { periodSlotUiByKind: PromotionCheckoutSlotsByKind },
): {
  purchases: [];
  mockPromotionCheckout: boolean;
  stripePublishableKey: string | null;
  periodSlotUiByKind: PromotionCheckoutSlotsByKind;
} {
  return {
    purchases: [],
    mockPromotionCheckout: env.mockPromotionCheckout,
    stripePublishableKey: env.stripePublishableKey,
    periodSlotUiByKind: env.periodSlotUiByKind,
  };
}
