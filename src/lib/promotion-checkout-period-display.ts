import { PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER } from "@/lib/promotion-policy-shared";
import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";
import { placementPeriodTierLabel } from "@/lib/promotion-period-pacific";
import { promotionPriceCentsForKind } from "@/lib/promotions";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Picker rows before a period is chosen — no date math. */
export function staticPromotionPeriodPickerRows(kind: PlacementCheckoutPromotionKind) {
  const baseCents = promotionPriceCentsForKind(kind);
  const deferredCents = baseCents * PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER;

  return [
    { offset: 0 as const, periodName: placementPeriodTierLabel(0), priceLine: "prorated" },
    { offset: 1 as const, periodName: placementPeriodTierLabel(1), priceLine: formatMoney(baseCents) },
    {
      offset: 2 as const,
      periodName: placementPeriodTierLabel(2),
      priceLine: `${formatMoney(deferredCents)} (${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×)`,
    },
  ];
}

/** After `?period=` — label includes Pacific window; current uses proration at `now`. */
export function formatComputedPeriodChoiceLine(c: PlacementPeriodChoiceUi): string {
  const pricePart = formatMoney(c.amountCents);
  const suffix =
    (c.isProrated ? " (prorated)" : "") +
    (c.isSecondFuturePeriod ? ` (${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×)` : "");
  return `${c.placementMonthLabel} — ${pricePart}${suffix}`;
}

export function computedPeriodChoice(
  choices: PlacementPeriodChoiceUi[],
  offset: 0 | 1 | 2,
): PlacementPeriodChoiceUi | undefined {
  return choices.find((c) => c.offset === offset);
}
