import { prisma } from "@/lib/prisma";
import { computePopularBrowseOrderedListingIds } from "@/lib/shop-listing-popular-browse-order-compute";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";

const SNAPSHOT_ID = "default";

/** Same scope as default `/shop/all` marketplace grid before tag/search filters. */
export const marketplacePopularBrowseSnapshotWhere = {
  ...marketplaceAggregatedListingWhere,
  product: { active: true },
};

function parseListingIdsOrdered(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.length > 0) out.push(x);
  }
  return out;
}

export async function rebuildPlatformPopularListingOrderSnapshot(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  try {
    const ids = await computePopularBrowseOrderedListingIds(
      marketplacePopularBrowseSnapshotWhere,
    );
    await prisma.platformPopularListingOrderSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      create: {
        id: SNAPSHOT_ID,
        listingIdsOrdered: ids,
        computedAt: new Date(),
      },
      update: {
        listingIdsOrdered: ids,
        computedAt: new Date(),
      },
    });
    return { ok: true, count: ids.length };
  } catch (e) {
    console.error("[rebuildPlatformPopularListingOrderSnapshot]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * Full-catalog Popular order for storefront reads: snapshot only (no live ranking on request).
 * Cron rebuilds daily; cold deploy may return [] until the first successful daily run.
 */
export async function getOrRebuildPlatformPopularListingOrderSnapshotIds(): Promise<string[]> {
  let ids = (await getPlatformPopularListingOrderSnapshotIds()) ?? [];
  if (ids.length > 0) return ids;

  const rebuilt = await rebuildPlatformPopularListingOrderSnapshot();
  if (rebuilt.ok) {
    ids = (await getPlatformPopularListingOrderSnapshotIds()) ?? [];
  }
  return ids;
}

/** Full-catalog Popular order for intersecting with filtered browse queries; `null` if unset. */
export async function getPlatformPopularListingOrderSnapshotIds(): Promise<
  string[] | null
> {
  const snapshot = prisma.platformPopularListingOrderSnapshot;
  if (!snapshot?.findUnique) return null;

  try {
    const row = await snapshot.findUnique({
      where: { id: SNAPSHOT_ID },
      select: { listingIdsOrdered: true },
    });
    const ids = parseListingIdsOrdered(row?.listingIdsOrdered);
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}
