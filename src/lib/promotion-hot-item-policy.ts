import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PromotionKind, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import {
  HOT_ITEM_PLATFORM_PERIOD_CAP,
  POPULAR_ITEM_PLATFORM_PERIOD_CAP,
  PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER,
  TOP_SHOP_PLATFORM_PERIOD_CAP,
  PROMOTION_PERIOD_DAYS,
} from "./promotion-policy-shared";
import {
  addPacificCalendarDays,
  formatPromotionPlacementPeriodChoiceLabel,
  getPromotionPeriodIndexContaining,
  pacificInclusiveDayCountFromThroughPeriodEnd,
  prorateCentsForRemainingDays,
  promotionPeriodEndExclusiveUtc,
  promotionPeriodStartUtc,
} from "./promotion-period-pacific";
import {
  buildPlacementPeriodChoices,
  resolveCappedPlacementPeriodOfferWithPrefilledCounts,
} from "./promotion-placement-ui-pure";

export { buildPlacementPeriodChoices, type PlacementPeriodChoiceUi } from "./promotion-placement-ui-pure";

/**
 * Placement offers with Prisma slot counts. Pacific two-week windows — see {@link "./promotion-period-pacific"}.
 */

export type PlacementPeriodOffer =
  | {
      amountCents: number;
      /** Always the Pacific period start for the purchased window (slot accounting). */
      eligibleFrom: Date;
      placementPeriodLabel: string;
      /** Mid-period purchase paid less than full listing price. */
      isProrated: boolean;
      /** Buying the second future period (filled current + next) at 2× base. */
      isSecondFuturePeriod: boolean;
      /** 0 = current Pacific period, 1 = next, 2 = second next (2×). No purchases beyond 2. */
      futurePeriodOffset: 0 | 1 | 2;
    }
  | { error: string };

/** @deprecated Use {@link PlacementPeriodOffer} */
export type MonthlyPlacementOffer = PlacementPeriodOffer;
/** @deprecated Use {@link PlacementPeriodOffer} */
export type HotItemPlacementOffer = PlacementPeriodOffer;

/** Paid rows of `kind` attributed to the promotion window starting `periodStartUtc` (Pacific period chain). */
/**
 * One DB round-trip for Hot item + Top shop paid-slot counts across the three upcoming Pacific
 * placement periods (same logic as three {@link countPromotionKindPaidForPlacementPeriod} calls per kind).
 */
export async function countHotAndTopShopPaidSlotsThreePeriodsBatch(
  periodStarts: [Date, Date, Date],
): Promise<{
  hot: [number, number, number];
  top: [number, number, number];
  popular: [number, number, number];
}> {
  const e0 = addPacificCalendarDays(periodStarts[0], PROMOTION_PERIOD_DAYS);
  const e1 = addPacificCalendarDays(periodStarts[1], PROMOTION_PERIOD_DAYS);
  const e2 = addPacificCalendarDays(periodStarts[2], PROMOTION_PERIOD_DAYS);

  type Row = { kind: string; c0: bigint; c1: bigint; c2: bigint };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      kind::text AS kind,
      COUNT(*) FILTER (
        WHERE ("eligibleFrom" >= ${periodStarts[0]} AND "eligibleFrom" < ${e0})
          OR ("eligibleFrom" IS NULL AND "paidAt" >= ${periodStarts[0]} AND "paidAt" < ${e0})
      ) AS c0,
      COUNT(*) FILTER (
        WHERE ("eligibleFrom" >= ${periodStarts[1]} AND "eligibleFrom" < ${e1})
          OR ("eligibleFrom" IS NULL AND "paidAt" >= ${periodStarts[1]} AND "paidAt" < ${e1})
      ) AS c1,
      COUNT(*) FILTER (
        WHERE ("eligibleFrom" >= ${periodStarts[2]} AND "eligibleFrom" < ${e2})
          OR ("eligibleFrom" IS NULL AND "paidAt" >= ${periodStarts[2]} AND "paidAt" < ${e2})
      ) AS c2
    FROM "PromotionPurchase"
    WHERE "status" = 'paid'::"PromotionPurchaseStatus"
      AND "paidAt" IS NOT NULL
      AND kind IN (
        'HOT_FEATURED_ITEM'::"PromotionKind",
        'FEATURED_SHOP_HOME'::"PromotionKind",
        'MOST_POPULAR_OF_TAG_ITEM'::"PromotionKind"
      )
    GROUP BY kind
  `;

  const triplet = (r: Row | undefined): [number, number, number] =>
    r ? [Number(r.c0), Number(r.c1), Number(r.c2)] : [0, 0, 0];

  return {
    hot: triplet(rows.find((x) => x.kind === PromotionKind.HOT_FEATURED_ITEM)),
    top: triplet(rows.find((x) => x.kind === PromotionKind.FEATURED_SHOP_HOME)),
    popular: triplet(rows.find((x) => x.kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM)),
  };
}

/**
 * Three indexed counts for one promotion kind (fast path for checkout — avoids the full-table
 * {@link countHotAndTopShopPaidSlotsThreePeriodsBatch} scan).
 */
export async function countPromotionKindPaidSlotsThreePeriods(
  kind: PromotionKind,
  periodStarts: [Date, Date, Date],
): Promise<[number, number, number]> {
  const counts = await Promise.all(
    periodStarts.map((periodStart) => countPromotionKindPaidForPlacementPeriod(kind, periodStart)),
  );
  return counts as [number, number, number];
}

/** Cached per-kind slot counts for dashboard checkout and pay actions. */
export async function countPromotionKindPaidSlotsThreePeriodsCached(
  kind: PromotionKind,
  periodStarts: [Date, Date, Date],
): Promise<[number, number, number]> {
  const keys = periodStarts.map((d) => d.toISOString()) as [string, string, string];
  return unstable_cache(
    async () => countPromotionKindPaidSlotsThreePeriods(kind, periodStarts),
    ["promotion-kind-slot-counts", kind, keys[0], keys[1], keys[2]],
    { revalidate: 120 },
  )();
}

/** @deprecated Prefer {@link countPromotionKindPaidSlotsThreePeriodsCached} for single-kind checkout. */
export async function countHotAndTopShopPaidSlotsThreePeriodsBatchCached(
  periodStarts: [Date, Date, Date],
): Promise<Awaited<ReturnType<typeof countHotAndTopShopPaidSlotsThreePeriodsBatch>>> {
  const keys = periodStarts.map((d) => d.toISOString()) as [string, string, string];
  return unstable_cache(
    async () => countHotAndTopShopPaidSlotsThreePeriodsBatch(periodStarts),
    ["promotion-slot-counts-batch", keys[0], keys[1], keys[2]],
    { revalidate: 120 },
  )();
}

export async function countPromotionKindPaidForPlacementPeriod(
  kind: PromotionKind,
  periodStartUtc: Date,
): Promise<number> {
  const periodEndEx = addPacificCalendarDays(periodStartUtc, PROMOTION_PERIOD_DAYS);
  return prisma.promotionPurchase.count({
    where: {
      kind,
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null },
      OR: [
        {
          eligibleFrom: {
            gte: periodStartUtc,
            lt: periodEndEx,
          },
        },
        {
          eligibleFrom: null,
          paidAt: {
            gte: periodStartUtc,
            lt: periodEndEx,
          },
        },
      ],
    },
  });
}

/** @deprecated Use {@link countPromotionKindPaidForPlacementPeriod} */
export async function countPromotionKindPaidForPlacementMonthUtc(
  kind: PromotionKind,
  placementMonthStart: Date,
): Promise<number> {
  return countPromotionKindPaidForPlacementPeriod(kind, placementMonthStart);
}

export async function countHotItemPaidForPlacementPeriodUtc(
  periodStartUtc: Date,
): Promise<number> {
  return countPromotionKindPaidForPlacementPeriod(
    PromotionKind.HOT_FEATURED_ITEM,
    periodStartUtc,
  );
}

/** @deprecated Use {@link countHotItemPaidForPlacementPeriodUtc} */
export async function countHotItemPaidForPlacementMonthUtc(
  placementMonthStart: Date,
): Promise<number> {
  return countHotItemPaidForPlacementPeriodUtc(placementMonthStart);
}

export async function countTopShopPaidForPlacementPeriodUtc(
  periodStartUtc: Date,
): Promise<number> {
  return countPromotionKindPaidForPlacementPeriod(
    PromotionKind.FEATURED_SHOP_HOME,
    periodStartUtc,
  );
}

/** @deprecated Use {@link countTopShopPaidForPlacementPeriodUtc} */
export async function countTopShopPaidForPlacementMonthUtc(
  placementMonthStart: Date,
): Promise<number> {
  return countTopShopPaidForPlacementPeriodUtc(placementMonthStart);
}

export async function resolveCappedPlacementPeriodOffer(
  basePriceCents: number,
  periodCap: number,
  kind: PromotionKind,
  soldOutMessage: string,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  const r = await resolveCappedPlacementPeriodOfferWithCounts(
    basePriceCents,
    periodCap,
    kind,
    soldOutMessage,
    nowInput,
  );
  return r.offer;
}

export type CappedPlacementPeriodOfferWithCounts = {
  offer: PlacementPeriodOffer;
  /** Paid slots for offsets [0,1,2] from the current placement period. */
  filledCounts: [number, number, number];
  /** Pacific period starts for offsets [0,1,2] from the current placement period. */
  periodStarts: [Date, Date, Date];
};

export async function resolveCappedPlacementPeriodOfferWithCounts(
  basePriceCents: number,
  periodCap: number,
  kind: PromotionKind,
  soldOutMessage: string,
  nowInput = new Date(),
  /** When set, skips per-period counts (e.g. from {@link countHotAndTopShopPaidSlotsThreePeriodsBatch}). */
  prefilledFilledCounts?: [number, number, number],
): Promise<CappedPlacementPeriodOfferWithCounts> {
  if (basePriceCents <= 0) {
    const idx = getPromotionPeriodIndexContaining(nowInput);
    const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(idx + o)) as [Date, Date, Date];
    return { offer: { error: "Invalid promotion price." }, filledCounts: [0, 0, 0], periodStarts };
  }
  if (periodCap <= 0) {
    const idx = getPromotionPeriodIndexContaining(nowInput);
    const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(idx + o)) as [Date, Date, Date];
    return { offer: { error: "Invalid cap." }, filledCounts: [0, 0, 0], periodStarts };
  }

  const currentIdx = getPromotionPeriodIndexContaining(nowInput);

  const offsets: Array<0 | 1 | 2> = [0, 1, 2];
  const periodStarts = offsets.map((offset) => promotionPeriodStartUtc(currentIdx + offset)) as [
    Date,
    Date,
    Date,
  ];
  if (prefilledFilledCounts) {
    return resolveCappedPlacementPeriodOfferWithPrefilledCounts(
      basePriceCents,
      periodCap,
      soldOutMessage,
      prefilledFilledCounts,
      nowInput,
    );
  }

  const filledCounts = (await Promise.all(
    periodStarts.map((periodStart) => countPromotionKindPaidForPlacementPeriod(kind, periodStart)),
  )) as [number, number, number];

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
        placementPeriodLabel: formatPromotionPlacementPeriodChoiceLabel(idx, offset as 0 | 1 | 2),
        isProrated,
        isSecondFuturePeriod,
        futurePeriodOffset: offset as 0 | 1 | 2,
      },
      filledCounts,
      periodStarts,
    };
  }

  return { offer: { error: soldOutMessage }, filledCounts, periodStarts };
}

export async function resolveHotItemPlacementOffer(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  const r = await resolveHotItemPlacementOfferWithCounts(basePriceCents, nowInput);
  return r.offer;
}

export async function resolveHotItemPlacementOfferWithCounts(
  basePriceCents: number,
  nowInput = new Date(),
  prefilledFilledCounts?: [number, number, number],
): Promise<CappedPlacementPeriodOfferWithCounts> {
  return resolveCappedPlacementPeriodOfferWithCounts(
    basePriceCents,
    HOT_ITEM_PLATFORM_PERIOD_CAP,
    PromotionKind.HOT_FEATURED_ITEM,
    "Hot item promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
    nowInput,
    prefilledFilledCounts,
  );
}

export async function resolveTopShopPlacementOffer(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  const r = await resolveTopShopPlacementOfferWithCounts(basePriceCents, nowInput);
  return r.offer;
}

export async function resolveTopShopPlacementOfferWithCounts(
  basePriceCents: number,
  nowInput = new Date(),
  prefilledFilledCounts?: [number, number, number],
): Promise<CappedPlacementPeriodOfferWithCounts> {
  return resolveCappedPlacementPeriodOfferWithCounts(
    basePriceCents,
    TOP_SHOP_PLATFORM_PERIOD_CAP,
    PromotionKind.FEATURED_SHOP_HOME,
    "Top shop promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
    nowInput,
    prefilledFilledCounts,
  );
}

export function purchaseOfferForChosenPlacementOffset(
  basePriceCents: number,
  periodCap: number,
  filledCounts: [number, number, number],
  periodStarts: [Date, Date, Date],
  currentIdx: number,
  nowInput: Date,
  offset: 0 | 1 | 2,
):
  | { ok: true; amountCents: number; eligibleFrom: Date }
  | { ok: false; error: string } {
  const choices = buildPlacementPeriodChoices(
    basePriceCents,
    periodCap,
    filledCounts,
    periodStarts,
    currentIdx,
    nowInput,
  );
  const chosen = choices.find((c) => c.offset === offset);
  if (!chosen) return { ok: false, error: "Invalid placement period." };
  if (!chosen.selectable) {
    return {
      ok: false,
      error: chosen.disabledReason ?? "That placement period is not available.",
    };
  }
  return {
    ok: true,
    amountCents: chosen.amountCents,
    eligibleFrom: new Date(chosen.eligibleFromIso),
  };
}

export async function resolvePopularPlacementOfferWithCounts(
  basePriceCents: number,
  nowInput = new Date(),
  prefilledFilledCounts?: [number, number, number],
): Promise<CappedPlacementPeriodOfferWithCounts> {
  return resolveCappedPlacementPeriodOfferWithCounts(
    basePriceCents,
    POPULAR_ITEM_PLATFORM_PERIOD_CAP,
    PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
    "Popular item promotion slots are fully booked for the next two placement periods. Try again later or contact support.",
    nowInput,
    prefilledFilledCounts,
  );
}

export async function resolvePopularPlacementOffer(
  basePriceCents: number,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  const r = await resolvePopularPlacementOfferWithCounts(basePriceCents, nowInput);
  return r.offer;
}

/** @deprecated Use {@link resolveCappedPlacementPeriodOffer} */
export async function resolveMonthlyCappedPlacementOffer(
  basePriceCents: number,
  monthlyCap: number,
  kind: PromotionKind,
  soldOutMessage: string,
  nowInput = new Date(),
): Promise<PlacementPeriodOffer> {
  return resolveCappedPlacementPeriodOffer(basePriceCents, monthlyCap, kind, soldOutMessage, nowInput);
}
