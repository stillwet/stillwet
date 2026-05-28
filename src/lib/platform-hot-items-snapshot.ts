import type { ProductCardProduct } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";
import {
  collectPlatformHotItemsListings,
  getPlatformAllPageFeaturedProducts,
  hotItemsListingInclude,
  type HotItemListing,
} from "@/lib/platform-all-page-featured";
import { PLATFORM_ALL_PAGE_FEATURED_LIMIT } from "@/lib/platform-all-page-featured-constants";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";

const SNAPSHOT_ID = "default";

function parseListingIdsOrdered(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.length > 0) out.push(x);
  }
  return out;
}

/**
 * Recompute Hot items listing ids (same algorithm as live ranking) and persist for fast reads.
 */
export async function rebuildPlatformBrowseHotItemsSnapshot(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  try {
    const listings = await collectPlatformHotItemsListings(
      PLATFORM_ALL_PAGE_FEATURED_LIMIT,
    );
    const ids = listings.map((l) => l.id);
    await prisma.platformBrowseHotItemsSnapshot.upsert({
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
    console.error("[rebuildPlatformBrowseHotItemsSnapshot]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

/**
 * Primary Hot items for `/shop/all`: hydrate snapshot ids with one `findMany`, preserve order.
 * Snapshot-only: this list is allowed to be stale; avoid live fallbacks that can hang `/shop/all`.
 */
export async function getPlatformHotItemsPrimaryProducts(): Promise<
  ProductCardProduct[]
> {
  const snapshot = prisma.platformBrowseHotItemsSnapshot;
  if (!snapshot?.findUnique) {
    return [];
  }

  try {
    const row = await snapshot.findUnique({
      where: { id: SNAPSHOT_ID },
      select: { listingIdsOrdered: true },
    });

    const orderedIds = parseListingIdsOrdered(row?.listingIdsOrdered);
    if (orderedIds.length === 0) {
      return [];
    }

    const listings = await prisma.shopListing.findMany({
      where: {
        id: { in: orderedIds },
        ...marketplaceAggregatedListingWhere,
        product: { active: true },
      },
      include: hotItemsListingInclude,
    });

    const byId = new Map<string, HotItemListing>();
    for (const l of listings) {
      byId.set(l.id, l);
    }

    const ordered: HotItemListing[] = [];
    for (const id of orderedIds) {
      const l = byId.get(id);
      if (l) ordered.push(l);
    }

    if (ordered.length === 0) {
      return [];
    }

    return ordered.map((l) => productCardProductFromListing(l));
  } catch (e) {
    console.warn(
      "[getPlatformHotItemsPrimaryProducts] snapshot unavailable; returning empty",
      e,
    );
    return [];
  }
}
