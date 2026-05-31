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

/** After `?period=` — split label + price for aligned picker columns. */
export function placementPeriodChoiceDisplayParts(c: PlacementPeriodChoiceUi): {
  tier: string;
  dateRange: string;
  price: string;
  priceSuffix: string;
} {
  const sep = " — ";
  const i = c.placementMonthLabel.indexOf(sep);
  const tier = i === -1 ? c.placementMonthLabel : c.placementMonthLabel.slice(0, i);
  const dateRange = i === -1 ? "" : c.placementMonthLabel.slice(i + sep.length);
  const price = formatMoney(c.amountCents);
  const priceSuffix =
    (c.isProrated ? " (prorated)" : "") +
    (c.isSecondFuturePeriod ? ` (${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×)` : "");
  return { tier, dateRange, price, priceSuffix };
}

/** After `?period=` — single-line label (legacy). */
export function formatComputedPeriodChoiceLine(c: PlacementPeriodChoiceUi): string {
  const { tier, dateRange, price, priceSuffix } = placementPeriodChoiceDisplayParts(c);
  return `${tier} — ${dateRange} — ${price}${priceSuffix}`;
}

export function computedPeriodChoice(
  choices: PlacementPeriodChoiceUi[],
  offset: 0 | 1 | 2,
): PlacementPeriodChoiceUi | undefined {
  return choices.find((c) => c.offset === offset);
}
