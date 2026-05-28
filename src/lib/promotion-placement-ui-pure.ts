/**
 * Promotion placement UI math with no Prisma/DB — safe for Client Components.
 */
import { PromotionKind } from "@/generated/prisma/enums";
import type { PromotionMonthlySlotUi } from "@/lib/promotion-dashboard-ui-types";
import { promotionPriceCentsForKind } from "@/lib/promotions";
import {
  HOT_ITEM_PLATFORM_PERIOD_CAP,
  POPULAR_ITEM_PLATFORM_PERIOD_CAP,
  PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER,
  PROMOTION_PERIOD_DAYS,
  TOP_SHOP_PLATFORM_PERIOD_CAP,
} from "@/lib/promotion-policy-shared";
import {
  currentListingPromotionPeriodStartUtc,
  formatPromotionPlacementPeriodChoiceLabel,
  getPromotionPeriodIndexContaining,
  pacificInclusiveDayCountFromThroughPeriodEnd,
  prorateCentsForRemainingDays,
  promotionPeriodEndExclusiveUtc,
  promotionPeriodStartUtc,
} from "@/lib/promotion-period-pacific";

export type PlacementCheckoutPromotionKind = Extract<
  PromotionKind,
  "HOT_FEATURED_ITEM" | "FEATURED_SHOP_HOME" | "MOST_POPULAR_OF_TAG_ITEM"
>;

export type PlacementPeriodChoiceUi = {
  offset: 0 | 1 | 2;
  placementMonthLabel: string;
  amountCents: number;
  eligibleFromIso: string;
  selectable: boolean;
  disabledReason: string | null;
  isProrated: boolean;
  isSecondFuturePeriod: boolean;
};

/** Pacific date windows shared by every promotion checkout kind (prices differ per kind). */
export type SharedPlacementPeriodCalendarRow = Pick<
  PlacementPeriodChoiceUi,
  "offset" | "placementMonthLabel" | "eligibleFromIso" | "isProrated" | "isSecondFuturePeriod"
>;

const ZERO_FILLED: [number, number, number] = [0, 0, 0];

function placementPeriodCapForKind(kind: PlacementCheckoutPromotionKind): number {
  if (kind === PromotionKind.HOT_FEATURED_ITEM) return HOT_ITEM_PLATFORM_PERIOD_CAP;
  if (kind === PromotionKind.FEATURED_SHOP_HOME) return TOP_SHOP_PLATFORM_PERIOD_CAP;
  return POPULAR_ITEM_PLATFORM_PERIOD_CAP;
}

export function amountCentsForPlacementOffset(
  offset: 0 | 1 | 2,
  basePriceCents: number,
  currentIdx: number,
  nowInput: Date,
): Pick<PlacementPeriodChoiceUi, "amountCents" | "isProrated" | "isSecondFuturePeriod"> {
  const idx = currentIdx + offset;
  const periodEndExclusive = promotionPeriodEndExclusiveUtc(idx);
  const periodEndInclusive = new Date(periodEndExclusive.getTime() - 1);
  const isSecondFuturePeriod = offset === 2;

  if (offset === 0) {
    const daysRemaining = pacificInclusiveDayCountFromThroughPeriodEnd(nowInput, periodEndInclusive);
    let amountCents = prorateCentsForRemainingDays(basePriceCents, daysRemaining);
    if (!Number.isSafeInteger(amountCents)) amountCents = 0;
    return {
      amountCents,
      isProrated: daysRemaining < PROMOTION_PERIOD_DAYS,
      isSecondFuturePeriod,
    };
  }

  if (offset === 1) {
    return { amountCents: basePriceCents, isProrated: false, isSecondFuturePeriod };
  }

  let amountCents = basePriceCents * PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER;
  if (!Number.isSafeInteger(amountCents)) amountCents = 0;
  return { amountCents, isProrated: false, isSecondFuturePeriod };
}

/** One Pacific calendar for Current / Upcoming / Following — same for all promotion kinds. */
export function buildSharedPlacementPeriodCalendarChoices(
  nowInput = new Date(),
): SharedPlacementPeriodCalendarRow[] {
  const currentIdx = getPromotionPeriodIndexContaining(nowInput);
  const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(currentIdx + o)) as [
    Date,
    Date,
    Date,
  ];
  const offsets = [0, 1, 2] as const;
  return offsets.map((offset) => {
    const idx = currentIdx + offset;
    const periodStart = periodStarts[offset];
    const pricing = amountCentsForPlacementOffset(offset, 1, currentIdx, nowInput);
    return {
      offset,
      placementMonthLabel: formatPromotionPlacementPeriodChoiceLabel(idx, offset),
      eligibleFromIso: periodStart.toISOString(),
      isProrated: pricing.isProrated,
      isSecondFuturePeriod: pricing.isSecondFuturePeriod,
    };
  });
}

/** Apply per-kind list prices and slot caps to the shared calendar. */
export function mergeSharedCalendarWithKindPricing(
  calendar: readonly SharedPlacementPeriodCalendarRow[],
  kind: PlacementCheckoutPromotionKind,
  filledCounts: [number, number, number] = ZERO_FILLED,
  nowInput = new Date(),
): PlacementPeriodChoiceUi[] {
  const basePriceCents = promotionPriceCentsForKind(kind);
  const periodCap = placementPeriodCapForKind(kind);
  const currentIdx = getPromotionPeriodIndexContaining(nowInput);

  return calendar.map((row) => {
    const filled = filledCounts[row.offset];
    const pricing = amountCentsForPlacementOffset(row.offset, basePriceCents, currentIdx, nowInput);
    const selectable = filled < periodCap;
    return {
      offset: row.offset,
      placementMonthLabel: row.placementMonthLabel,
      eligibleFromIso: row.eligibleFromIso,
      isProrated: pricing.isProrated,
      isSecondFuturePeriod: pricing.isSecondFuturePeriod,
      amountCents: pricing.amountCents,
      selectable,
      disabledReason: selectable ? null : "This period is full.",
    };
  });
}

type PlacementPeriodOffer =
  | {
      amountCents: number;
      eligibleFrom: Date;
      placementPeriodLabel: string;
      isProrated: boolean;
      isSecondFuturePeriod: boolean;
      futurePeriodOffset: 0 | 1 | 2;
    }
  | { error: string };

type CappedPlacementPeriodOfferWithCounts = {
  offer: PlacementPeriodOffer;
  filledCounts: [number, number, number];
  periodStarts: [Date, Date, Date];
};

export function buildPlacementPeriodChoices(
  basePriceCents: number,
  periodCap: number,
  filledCounts: [number, number, number],
  periodStarts: [Date, Date, Date],
  currentIdx: number,
  nowInput: Date,
): PlacementPeriodChoiceUi[] {
  const calendar: SharedPlacementPeriodCalendarRow[] = [0, 1, 2].map((offset) => {
    const o = offset as 0 | 1 | 2;
    const idx = currentIdx + o;
    const periodStart = periodStarts[o];
    const pricing = amountCentsForPlacementOffset(o, 1, currentIdx, nowInput);
    return {
      offset: o,
      placementMonthLabel: formatPromotionPlacementPeriodChoiceLabel(idx, o),
      eligibleFromIso: periodStart.toISOString(),
      isProrated: pricing.isProrated,
      isSecondFuturePeriod: pricing.isSecondFuturePeriod,
    };
  });

  return calendar.map((row) => {
    const filled = filledCounts[row.offset];
    const pricing = amountCentsForPlacementOffset(row.offset, basePriceCents, currentIdx, nowInput);
    const selectable = filled < periodCap;
    return {
      ...row,
      amountCents: pricing.amountCents,
      isProrated: pricing.isProrated,
      isSecondFuturePeriod: pricing.isSecondFuturePeriod,
      selectable,
      disabledReason: selectable ? null : "This period is full.",
    };
  });
}

export function resolveCappedPlacementPeriodOfferWithPrefilledCounts(
  basePriceCents: number,
  periodCap: number,
  soldOutMessage: string,
  filledCounts: [number, number, number],
  nowInput = new Date(),
): CappedPlacementPeriodOfferWithCounts {
  if (basePriceCents <= 0) {
    const idx = getPromotionPeriodIndexContaining(nowInput);
    const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(idx + o)) as [Date, Date, Date];
    return { offer: { error: "Invalid promotion price." }, filledCounts, periodStarts };
  }
  if (periodCap <= 0) {
    const idx = getPromotionPeriodIndexContaining(nowInput);
    const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(idx + o)) as [Date, Date, Date];
    return { offer: { error: "Invalid cap." }, filledCounts, periodStarts };
  }

  const currentIdx = getPromotionPeriodIndexContaining(nowInput);
  const offsets: Array<0 | 1 | 2> = [0, 1, 2];
  const periodStarts = offsets.map((offset) => promotionPeriodStartUtc(currentIdx + offset)) as [
    Date,
    Date,
    Date,
  ];

  for (const offset of offsets) {
    const idx = currentIdx + offset;
    const periodStart = periodStarts[offset];
    const filled = filledCounts[offset];

    if (filled >= periodCap) {
      continue;
    }

    const periodEndExclusive = promotionPeriodEndExclusiveUtc(idx);
    const periodEndInclusive = new Date(periodEndExclusive.getTime() - 1);

    let amountCents: number;
    let isProrated = false;
    const isSecondFuturePeriod = offset === 2;

    if (offset === 0) {
      const daysRemaining = pacificInclusiveDayCountFromThroughPeriodEnd(
        nowInput,
        periodEndInclusive,
      );
      amountCents = prorateCentsForRemainingDays(basePriceCents, daysRemaining);
      isProrated = daysRemaining < PROMOTION_PERIOD_DAYS;
    } else if (offset === 1) {
      amountCents = basePriceCents;
    } else {
      amountCents = basePriceCents * PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER;
    }

    if (!Number.isSafeInteger(amountCents)) {
      return { offer: { error: "Promotion price overflow." }, filledCounts, periodStarts };
    }

    return {
      offer: {
        amountCents,
        eligibleFrom: periodStart,
        placementPeriodLabel: formatPromotionPlacementPeriodChoiceLabel(idx, offset),
        isProrated,
        isSecondFuturePeriod,
        futurePeriodOffset: offset,
      },
      filledCounts,
      periodStarts,
    };
  }

  return { offer: { error: soldOutMessage }, filledCounts, periodStarts };
}

function promotionMonthlySlotUiFromCappedCounts(
  baseCents: number,
  periodCap: number,
  r: CappedPlacementPeriodOfferWithCounts,
  currentPlacementIdx: number,
  nowForOffers: Date,
): PromotionMonthlySlotUi {
  const periodStartUtc = currentListingPromotionPeriodStartUtc(new Date());
  const periodIndex = r.periodStarts.findIndex((d) => d.getTime() === periodStartUtc.getTime());
  const slotsUsedUtcThisMonth =
    periodIndex >= 0 ? r.filledCounts[periodIndex as 0 | 1 | 2] : 0;
  const periodChoices = buildPlacementPeriodChoices(
    baseCents,
    periodCap,
    r.filledCounts,
    r.periodStarts,
    currentPlacementIdx,
    nowForOffers,
  );
  const offerResolved = r.offer;
  return {
    monthlyCap: periodCap,
    slotsUsedUtcThisMonth,
    periodChoices,
    offerError: offerResolved && "error" in offerResolved ? offerResolved.error : null,
    offer:
      offerResolved && !("error" in offerResolved)
        ? {
            amountCents: offerResolved.amountCents,
            eligibleFromIso: offerResolved.eligibleFrom.toISOString(),
            isDeferred: offerResolved.futurePeriodOffset > 0,
            isSecondFuturePeriod: offerResolved.isSecondFuturePeriod,
            isProrated: offerResolved.isProrated,
            placementMonthLabel: offerResolved.placementPeriodLabel,
          }
        : null,
  };
}

/** Checkout period rows for one kind — reuses {@link buildSharedPlacementPeriodCalendarChoices}. */
export function optimisticPlacementPeriodChoicesForKind(
  kind: PlacementCheckoutPromotionKind,
  nowForOffers = new Date(),
): PlacementPeriodChoiceUi[] {
  const calendar = buildSharedPlacementPeriodCalendarChoices(nowForOffers);
  return mergeSharedCalendarWithKindPricing(calendar, kind, ZERO_FILLED, nowForOffers);
}

/** Instant checkout UI before DB slot counts return (assumes slots available). */
export function optimisticPromotionMonthlySlotUiForKind(
  kind: PlacementCheckoutPromotionKind,
  nowForOffers = new Date(),
): PromotionMonthlySlotUi {
  const currentPlacementIdx = getPromotionPeriodIndexContaining(nowForOffers);
  const periodChoices = optimisticPlacementPeriodChoicesForKind(kind, nowForOffers);

  if (kind === PromotionKind.HOT_FEATURED_ITEM) {
    const baseCents = promotionPriceCentsForKind(PromotionKind.HOT_FEATURED_ITEM);
    const r = resolveCappedPlacementPeriodOfferWithPrefilledCounts(
      baseCents,
      HOT_ITEM_PLATFORM_PERIOD_CAP,
      "Hot item promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
      ZERO_FILLED,
      nowForOffers,
    );
    const ui = promotionMonthlySlotUiFromCappedCounts(
      baseCents,
      HOT_ITEM_PLATFORM_PERIOD_CAP,
      r,
      currentPlacementIdx,
      nowForOffers,
    );
    return { ...ui, periodChoices };
  }

  if (kind === PromotionKind.FEATURED_SHOP_HOME) {
    const baseCents = promotionPriceCentsForKind(PromotionKind.FEATURED_SHOP_HOME);
    const r = resolveCappedPlacementPeriodOfferWithPrefilledCounts(
      baseCents,
      TOP_SHOP_PLATFORM_PERIOD_CAP,
      "Top shop promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
      ZERO_FILLED,
      nowForOffers,
    );
    const ui = promotionMonthlySlotUiFromCappedCounts(
      baseCents,
      TOP_SHOP_PLATFORM_PERIOD_CAP,
      r,
      currentPlacementIdx,
      nowForOffers,
    );
    return { ...ui, periodChoices };
  }

  const baseCents = promotionPriceCentsForKind(PromotionKind.MOST_POPULAR_OF_TAG_ITEM);
  const r = resolveCappedPlacementPeriodOfferWithPrefilledCounts(
    baseCents,
    POPULAR_ITEM_PLATFORM_PERIOD_CAP,
    "Popular item promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
    ZERO_FILLED,
    nowForOffers,
  );
  const ui = promotionMonthlySlotUiFromCappedCounts(
    baseCents,
    POPULAR_ITEM_PLATFORM_PERIOD_CAP,
    r,
    currentPlacementIdx,
    nowForOffers,
  );
  return { ...ui, periodChoices };
}
