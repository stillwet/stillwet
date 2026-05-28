import type { PromotionMonthlySlotUi } from "@/lib/promotion-dashboard-ui-types";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** Client-safe promotion checkout slot map (no Prisma / server data loaders). */
export type PromotionCheckoutSlotsByKind = Record<
  PlacementCheckoutPromotionKind,
  PromotionMonthlySlotUi
>;
