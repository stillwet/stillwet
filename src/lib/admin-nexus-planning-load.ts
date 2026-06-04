import { revalidateTag, unstable_cache } from "next/cache";
import type { PrismaClient } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ALL_US_NEXUS_STATE_CODES } from "@/lib/us-economic-nexus-thresholds";
import { sortIntlNexusDestinationRows, sortUsNexusDestinationRows } from "@/lib/admin-nexus-planning-sort";
import { finalizeNexusPlanningSnapshot } from "@/lib/admin-nexus-planning-demo";

/** Max age before a rollup may be recomputed (7 days). */
export const NEXUS_PLANNING_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const NEXUS_PLANNING_CACHE_TAG = "admin-nexus-planning" as const;

export type AdminNexusDestinationRow = {
  /** US state code, ISO country code, or "UNKNOWN". */
  code: string;
  orderCount: number;
  merchandiseCents: number;
};

export type AdminNexusPlanningSnapshot = {
  usStates: AdminNexusDestinationRow[];
  international: AdminNexusDestinationRow[];
  missingDestination: AdminNexusDestinationRow | null;
  grandOrderCount: number;
  grandMerchandiseCents: number;
};

export type AdminNexusPlanningCachePayload = {
  computedAt: string;
  snapshot: AdminNexusPlanningSnapshot;
};

export type AdminNexusPlanningLoadResult = {
  snapshot: AdminNexusPlanningSnapshot;
  /** Set when serving the cached all-time rollup. */
  computedAt: Date | null;
  cacheNote: string | null;
};

export function shouldRefreshNexusPlanningCache(
  computedAt: Date,
  now: Date,
  hasRecentSale: boolean,
): boolean {
  if (now.getTime() - computedAt.getTime() < NEXUS_PLANNING_CACHE_TTL_MS) return false;
  return hasRecentSale;
}

function normalizeCountry(raw: string | null | undefined): string {
  const c = raw?.trim().toUpperCase() ?? "";
  if (!c) return "";
  if (c === "USA") return "US";
  return c;
}

function normalizeState(raw: string | null | undefined): string {
  return raw?.trim().toUpperCase() ?? "";
}

function isUnitedStates(country: string): boolean {
  return country === "US";
}

type Bucket = {
  orderCount: number;
  merchandiseCents: number;
};

function addToBucket(bucket: Bucket, merchandiseCents: number) {
  bucket.orderCount += 1;
  bucket.merchandiseCents += merchandiseCents;
}

function bucketToRow(code: string, bucket: Bucket): AdminNexusDestinationRow {
  return {
    code,
    orderCount: bucket.orderCount,
    merchandiseCents: bucket.merchandiseCents,
  };
}

/** All US states + DC, zero-filled, plus any non-standard ship-to codes (e.g. UNKNOWN). */
export function mergeUsNexusStateRows(usByState: Map<string, Bucket>): AdminNexusDestinationRow[] {
  const known = new Set(ALL_US_NEXUS_STATE_CODES);
  const rows = ALL_US_NEXUS_STATE_CODES.map((code) => {
    const bucket = usByState.get(code) ?? { orderCount: 0, merchandiseCents: 0 };
    return bucketToRow(code, bucket);
  });

  for (const [code, bucket] of usByState) {
    if (!known.has(code)) {
      rows.push(bucketToRow(code, bucket));
    }
  }

  return sortUsNexusDestinationRows(rows);
}

/** Paid merchandise orders rolled up by ship-to state (US) or country (non-US). */
export async function loadAdminNexusPlanningSnapshotRaw(
  prisma: PrismaClient,
  opts: { paidAt?: { gte?: Date; lte?: Date } } = {},
): Promise<AdminNexusPlanningSnapshot> {
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.paid,
      ...(opts.paidAt ? { createdAt: opts.paidAt } : {}),
    },
    select: {
      shippingState: true,
      shippingCountry: true,
      lines: { select: { unitPriceCents: true, quantity: true } },
    },
  });

  const usByState = new Map<string, Bucket>();
  const intlByCountry = new Map<string, Bucket>();
  let missing: Bucket | null = null;

  for (const o of orders) {
    const merchandiseCents = o.lines.reduce(
      (sum, line) => sum + line.unitPriceCents * line.quantity,
      0,
    );
    const country = normalizeCountry(o.shippingCountry);
    const state = normalizeState(o.shippingState);

    if (!country && !state) {
      missing ??= { orderCount: 0, merchandiseCents: 0 };
      addToBucket(missing, merchandiseCents);
      continue;
    }

    if (isUnitedStates(country) || (!country && state)) {
      const key = state || "UNKNOWN";
      const bucket = usByState.get(key) ?? {
        orderCount: 0,
        merchandiseCents: 0,
      };
      addToBucket(bucket, merchandiseCents);
      usByState.set(key, bucket);
      continue;
    }

    const key = country || "UNKNOWN";
    const bucket = intlByCountry.get(key) ?? {
      orderCount: 0,
      merchandiseCents: 0,
    };
    addToBucket(bucket, merchandiseCents);
    intlByCountry.set(key, bucket);
  }

  const usStates = mergeUsNexusStateRows(usByState);
  const international = sortIntlNexusDestinationRows(
    [...intlByCountry.entries()].map(([code, b]) => bucketToRow(code, b)),
  );

  const grandMerchandiseCents =
    usStates.reduce((s, r) => s + r.merchandiseCents, 0) +
    international.reduce((s, r) => s + r.merchandiseCents, 0) +
    (missing?.merchandiseCents ?? 0);
  const grandOrderCount =
    usStates.reduce((s, r) => s + r.orderCount, 0) +
    international.reduce((s, r) => s + r.orderCount, 0) +
    (missing?.orderCount ?? 0);

  return {
    usStates,
    international,
    missingDestination: missing ? bucketToRow("UNKNOWN", missing) : null,
    grandOrderCount,
    grandMerchandiseCents,
  };
}

export async function loadAdminNexusPlanningSnapshot(
  prisma: PrismaClient,
  opts: { paidAt?: { gte?: Date; lte?: Date } } = {},
): Promise<AdminNexusPlanningSnapshot> {
  return finalizeNexusPlanningSnapshot(await loadAdminNexusPlanningSnapshotRaw(prisma, opts));
}

async function hasPaidOrderSince(prismaClient: PrismaClient, since: Date): Promise<boolean> {
  const row = await prismaClient.order.findFirst({
    where: { status: OrderStatus.paid, createdAt: { gte: since } },
    select: { id: true },
  });
  return row != null;
}

async function computeNexusPlanningCachePayload(
  prismaClient: PrismaClient,
): Promise<AdminNexusPlanningCachePayload> {
  return {
    computedAt: new Date().toISOString(),
    snapshot: await loadAdminNexusPlanningSnapshotRaw(prismaClient, {}),
  };
}

const getStoredNexusPlanning = unstable_cache(
  async () => computeNexusPlanningCachePayload(prisma),
  ["admin-nexus-planning-v2"],
  { revalidate: false, tags: [NEXUS_PLANNING_CACHE_TAG] },
);

/**
 * All-time nexus rollup: cached up to 7 days; recomputed only when cache is stale AND a paid
 * order exists in the trailing 7 days. Custom date filters bypass cache (live query).
 */
export async function loadAdminNexusPlanningSnapshotCached(
  prismaClient: PrismaClient,
  opts: { paidAt?: { gte?: Date; lte?: Date } } = {},
): Promise<AdminNexusPlanningLoadResult> {
  const hasDateFilter = Boolean(opts.paidAt?.gte || opts.paidAt?.lte);
  if (hasDateFilter) {
    return {
      snapshot: await loadAdminNexusPlanningSnapshot(prismaClient, opts),
      computedAt: null,
      cacheNote: null,
    };
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - NEXUS_PLANNING_CACHE_TTL_MS);
  const cached = await getStoredNexusPlanning();
  const computedAt = new Date(cached.computedAt);

  if (now.getTime() - computedAt.getTime() < NEXUS_PLANNING_CACHE_TTL_MS) {
    return {
      snapshot: finalizeNexusPlanningSnapshot(cached.snapshot),
      computedAt,
      cacheNote: null,
    };
  }

  const hasRecentSale = await hasPaidOrderSince(prismaClient, weekAgo);
  if (!hasRecentSale) {
    return {
      snapshot: finalizeNexusPlanningSnapshot(cached.snapshot),
      computedAt,
      cacheNote: "No paid orders in the last 7 days — showing last rollup.",
    };
  }

  revalidateTag(NEXUS_PLANNING_CACHE_TAG, { expire: 0 });
  const fresh = await getStoredNexusPlanning();
  return {
    snapshot: finalizeNexusPlanningSnapshot(fresh.snapshot),
    computedAt: new Date(fresh.computedAt),
    cacheNote: null,
  };
}
