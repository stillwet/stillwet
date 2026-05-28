import { getPlacementPeriodChoicesForKind } from "@/lib/promotion-period-calendar-cache";
import {
  buildSharedPlacementPeriodCalendarChoices,
  mergeSharedCalendarWithKindPricing,
} from "@/lib/promotion-placement-ui-pure";
import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** Pacific windows + prices — one shared calendar, kind-specific pricing only. */
export function promotionPeriodChoicesAtClick(
  kind: PlacementCheckoutPromotionKind,
  now = new Date(),
): PlacementPeriodChoiceUi[] {
  if (typeof window !== "undefined") {
    return getPlacementPeriodChoicesForKind(kind, now);
  }
  const calendar = buildSharedPlacementPeriodCalendarChoices(now);
  return mergeSharedCalendarWithKindPricing(calendar, kind, undefined, now);
}
