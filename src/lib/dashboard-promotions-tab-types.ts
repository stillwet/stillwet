import type { DashboardPromotionPurchaseRow } from "@/lib/promotion-dashboard-ui-types";
import type { PromotionCheckoutSlotsByKind } from "@/lib/dashboard-promotions-payload-types";

export type PromotionPurchaseLifecycle =
  | "active"
  | "expired"
  | "scheduled"
  | "pending_payment"
  | "other";

export type DashboardPurchaseHistoryPurchaseType =
  | "promotion"
  | "shop_flair"
  | "shop_google_shopping";

export type PromotionPurchaseSummaryRow = DashboardPromotionPurchaseRow & {
  lifecycle: PromotionPurchaseLifecycle;
  purchaseType: DashboardPurchaseHistoryPurchaseType;
  googleShoppingPackId?: string;
  googleShoppingCreditsGranted?: number;
};

/** Promotions checkout + purchase history (client-safe; no Prisma). */
export type DashboardPromotionsTabSummaryPayload = {
  purchases: PromotionPurchaseSummaryRow[];
  mockPromotionCheckout: boolean;
  stripePublishableKey: string | null;
  checkoutSlotByKind?: PromotionCheckoutSlotsByKind;
  periodSlotUiByKind?: PromotionCheckoutSlotsByKind;
};
