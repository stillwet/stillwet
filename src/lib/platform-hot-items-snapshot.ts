import type { ProductCardProduct } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";
import { STILLWET_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  collectPlatformHotItemsListings,
  hotItemsListingInclude,
  type HotItemListing,
} from "@/lib/platform-all-page-featured";
import { PLATFORM_ALL_PAGE_FEATURED_LIMIT } from "@/lib/platform-all-page-featured-constants";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import {
  marketplaceAggregatedListingWhere,
  storefrontShopListingWhere,
} from "@/lib/shop-listing-storefront-visibility";

const SNAPSHOT_ID = "default";

function parseListingIdsOrdered(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.length > 0) out.push(x);
  }
  return out;
}

function hotItemsProductsFromListings(listings: HotItemListing[]): ProductCardProduct[] {
  return listings.map((l) => productCardProductFromListing(l));
}

async function hydrateHotItemsFromSnapshotIds(
  orderedIds: string[],
): Promise<ProductCardProduct[]> {
  if (orderedIds.length === 0) return [];

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

  return hotItemsProductsFromListings(ordered);
}

/** Live listings from the official Still Wet shop when snapshot ranking is empty. */
export async function loadPlatformHotItemsStillwetShopFallback(): Promise<
  ProductCardProduct[]
> {
  const shop = await prisma.shop.findFirst({
    where: { slug: STILLWET_SHOP_SLUG, active: true },
    select: { id: true },
  });
  if (!shop) return [];

  const listings = await prisma.shopListing.findMany({
    where: {
      shopId: shop.id,
      ...storefrontShopListingWhere,
      product: { active: true },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: PLATFORM_ALL_PAGE_FEATURED_LIMIT,
    include: hotItemsListingInclude,
  });

  return hotItemsProductsFromListings(listings);
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
 * Primary Hot items for `/shop/all`: daily snapshot first, then Still Wet shop listings.
 */
export async function getPlatformHotItemsPrimaryProducts(): Promise<
  ProductCardProduct[]
> {
  const snapshot = prisma.platformBrowseHotItemsSnapshot;
  if (snapshot?.findUnique) {
    try {
      const row = await snapshot.findUnique({
        where: { id: SNAPSHOT_ID },
        select: { listingIdsOrdered: true },
      });
      const fromSnapshot = await hydrateHotItemsFromSnapshotIds(
        parseListingIdsOrdered(row?.listingIdsOrdered),
      );
      if (fromSnapshot.length > 0) {
        return fromSnapshot;
      }
    } catch (e) {
      console.warn(
        "[getPlatformHotItemsPrimaryProducts] snapshot unavailable; trying Still Wet fallback",
        e,
      );
    }
  }

  try {
    return await loadPlatformHotItemsStillwetShopFallback();
  } catch (e) {
    console.warn("[getPlatformHotItemsPrimaryProducts] Still Wet fallback failed", e);
    return [];
  }
}
