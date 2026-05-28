import { prisma } from "@/lib/prisma";
import {
  computeFeaturedShopsRankedRows,
  CREATOR_SHOP_BASE,
  selectFeatured,
  toFeaturedRow,
  type ShopBrowseFeaturedRow,
} from "@/lib/shops-browse-page-featured-compute";
import { SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS } from "@/lib/platform-all-page-featured-constants";

const SNAPSHOT_ID = "default";

function parseShopIdsOrdered(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.length > 0) out.push(x);
  }
  return out;
}

/** Same cap as admin JSON max — snapshot serves `/shops` strip and home carousel slices. */
function featuredShopsSnapshotRankLimit(): number {
  return SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS;
}

export async function rebuildPlatformFeaturedShopsSnapshot(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  try {
    const rows = await computeFeaturedShopsRankedRows(featuredShopsSnapshotRankLimit());
    const ids = rows.map((r) => r.id);
    await prisma.platformFeaturedShopsSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      create: {
        id: SNAPSHOT_ID,
        shopIdsOrdered: ids,
        computedAt: new Date(),
      },
      update: {
        shopIdsOrdered: ids,
        computedAt: new Date(),
      },
    });
    return { ok: true, count: ids.length };
  } catch (e) {
    console.error("[rebuildPlatformFeaturedShopsSnapshot]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * Hydrates creator shops in snapshot order. Returns `null` when snapshot is missing/empty so callers
 * can fall back to {@link computeFeaturedShopsRankedRows}.
 */
export async function getFeaturedShopsRankedRowsFromSnapshot(
  limit: number,
): Promise<ShopBrowseFeaturedRow[] | null> {
  const snapshot = prisma.platformFeaturedShopsSnapshot;
  if (!snapshot?.findUnique) return null;

  try {
    const row = await snapshot.findUnique({
      where: { id: SNAPSHOT_ID },
      select: { shopIdsOrdered: true },
    });

    const orderedIds = parseShopIdsOrdered(row?.shopIdsOrdered).slice(0, limit);
    if (orderedIds.length === 0) return null;

    const shops = await prisma.shop.findMany({
      where: {
        id: { in: orderedIds },
        ...CREATOR_SHOP_BASE,
      },
      select: selectFeatured,
    });

    const byId = new Map(shops.map((s) => [s.id, toFeaturedRow(s)]));
    const out: ShopBrowseFeaturedRow[] = [];
    for (const id of orderedIds) {
      const r = byId.get(id);
      if (r) out.push(r);
    }

    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
