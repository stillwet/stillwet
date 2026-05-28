import { PromotionKind } from "@/generated/prisma/enums";
import type { PromotionMonthlySlotUi } from "@/lib/promotion-dashboard-ui-types";
import {
  optimisticPromotionMonthlySlotUiForKind,
  type PlacementCheckoutPromotionKind,
} from "@/lib/promotion-placement-ui-pure";
import type { PromotionCheckoutSlotsByKind } from "@/lib/dashboard-promotions-payload-types";

const CHECKOUT_KINDS: PlacementCheckoutPromotionKind[] = [
  PromotionKind.FEATURED_SHOP_HOME,
  PromotionKind.HOT_FEATURED_ITEM,
  PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
];

/** Period UI for one checkout kind only (cheaper than {@link promotionCheckoutSlotUiByKind}). */
export function promotionCheckoutSlotUiForSingleKind(
  kind: PlacementCheckoutPromotionKind,
  now = new Date(),
): PromotionMonthlySlotUi {
  return optimisticPromotionMonthlySlotUiForKind(kind, now);
}

/** Pacific period options + list prices for dashboard checkout (no DB). */
export function promotionCheckoutSlotUiByKind(now = new Date()): PromotionCheckoutSlotsByKind {
  return {
    [PromotionKind.FEATURED_SHOP_HOME]: optimisticPromotionMonthlySlotUiForKind(
      PromotionKind.FEATURED_SHOP_HOME,
      now,
    ),
    [PromotionKind.HOT_FEATURED_ITEM]: optimisticPromotionMonthlySlotUiForKind(
      PromotionKind.HOT_FEATURED_ITEM,
      now,
    ),
    [PromotionKind.MOST_POPULAR_OF_TAG_ITEM]: optimisticPromotionMonthlySlotUiForKind(
      PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
      now,
    ),
  };
}

export function promotionSlotUiForCheckoutKind(
  kind: PromotionKind,
  byKind: PromotionCheckoutSlotsByKind,
): PromotionMonthlySlotUi | null {
  if (!CHECKOUT_KINDS.includes(kind as PlacementCheckoutPromotionKind)) return null;
  return byKind[kind as PlacementCheckoutPromotionKind] ?? null;
}

export { optimisticPromotionMonthlySlotUiForKind, type PlacementCheckoutPromotionKind };
