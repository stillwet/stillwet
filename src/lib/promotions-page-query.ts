import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PromotionMonthlySlotUi } from "@/lib/promotion-dashboard-ui-types";

/** `?period=` for placement checkout (0 | 1 | 2). */
export function parsePlacementPeriodOffset(raw: string | undefined): 0 | 1 | 2 | null {
  if (raw === "0" || raw === "1" || raw === "2") return Number(raw) as 0 | 1 | 2;
  return null;
}

export function firstSelectablePlacementOffset(slotUi: PromotionMonthlySlotUi): 0 | 1 | 2 {
  const first = slotUi.periodChoices.find((c) => c.selectable);
  return (first?.offset ?? 0) as 0 | 1 | 2;
}

export function resolvePlacementPeriodOffset(
  slotUi: PromotionMonthlySlotUi,
  parsed: 0 | 1 | 2 | null,
): 0 | 1 | 2 {
  return resolvePlacementPeriodOffsetFromChoices(slotUi.periodChoices, parsed);
}

export function resolvePlacementPeriodOffsetFromChoices(
  choices: PlacementPeriodChoiceUi[],
  parsed: 0 | 1 | 2 | null,
): 0 | 1 | 2 {
  if (parsed != null) {
    const choice = choices.find((c) => c.offset === parsed);
    if (choice?.selectable) return parsed;
  }
  const first = choices.find((c) => c.selectable);
  return (first?.offset ?? 0) as 0 | 1 | 2;
}
