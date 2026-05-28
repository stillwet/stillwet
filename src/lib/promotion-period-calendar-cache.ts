import { PromotionKind } from "@/generated/prisma/enums";
import {
  buildSharedPlacementPeriodCalendarChoices,
  mergeSharedCalendarWithKindPricing,
  type PlacementCheckoutPromotionKind,
  type PlacementPeriodChoiceUi,
  type SharedPlacementPeriodCalendarRow,
} from "@/lib/promotion-placement-ui-pure";

const CHECKOUT_KINDS: PlacementCheckoutPromotionKind[] = [
  PromotionKind.FEATURED_SHOP_HOME,
  PromotionKind.HOT_FEATURED_ITEM,
  PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
];

/** Reuse calendar rows for ~60s so all kinds share one date computation per page session. */
const CALENDAR_TTL_MS = 60_000;

let calendarCache: { atMs: number; rows: SharedPlacementPeriodCalendarRow[] } | null = null;
const kindChoicesCache = new Map<string, PlacementPeriodChoiceUi[]>();

function cacheBucket(now: Date): number {
  return Math.floor(now.getTime() / CALENDAR_TTL_MS);
}

export function getSharedPlacementPeriodCalendar(now = new Date()): SharedPlacementPeriodCalendarRow[] {
  const atMs = now.getTime();
  if (calendarCache && Math.abs(atMs - calendarCache.atMs) < CALENDAR_TTL_MS) {
    return calendarCache.rows;
  }
  const rows = buildSharedPlacementPeriodCalendarChoices(now);
  calendarCache = { atMs, rows };
  return rows;
}

/** Per-kind prices on the shared calendar (not a separate date pass per kind). */
export function getPlacementPeriodChoicesForKind(
  kind: PlacementCheckoutPromotionKind,
  now = new Date(),
): PlacementPeriodChoiceUi[] {
  const key = `${kind}:${cacheBucket(now)}`;
  const hit = kindChoicesCache.get(key);
  if (hit) return hit;

  const choices = mergeSharedCalendarWithKindPricing(getSharedPlacementPeriodCalendar(now), kind, undefined, now);
  kindChoicesCache.set(key, choices);
  return choices;
}

/** Warm shared calendar + all checkout kinds (client-only; yields between kinds). */
export function prefetchPlacementPeriodCalendarCache(): void {
  if (typeof window === "undefined") return;
  const now = new Date();
  const calendar = getSharedPlacementPeriodCalendar(now);
  let i = 0;
  const step = () => {
    if (i >= CHECKOUT_KINDS.length) return;
    const kind = CHECKOUT_KINDS[i]!;
    const key = `${kind}:${cacheBucket(now)}`;
    if (!kindChoicesCache.has(key)) {
      kindChoicesCache.set(key, mergeSharedCalendarWithKindPricing(calendar, kind, undefined, now));
    }
    i += 1;
    if (i < CHECKOUT_KINDS.length) {
      setTimeout(step, 0);
    }
  };
  step();
}

export function schedulePlacementPeriodCalendarPrefetch(): void {
  if (typeof window === "undefined") return;
  const run = () => prefetchPlacementPeriodCalendarCache();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 50);
  }
}
