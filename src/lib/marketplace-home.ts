import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { OrderStatus } from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import type { ProductCardProduct } from "@/components/ProductCard";
import { productCardProductsFromListings } from "@/lib/shop-listing-product";
import { sortShopsForBrowse } from "@/lib/shops-browse";
import {
  HOME_HOT_CAROUSEL_DEFAULT_DISPLAY,
  HOME_HOT_CAROUSEL_MAX_ITEMS,
} from "@/lib/platform-all-page-featured-constants";
import {
  getOrderedHotFeaturedItemProductIds,
  getOrderedPopularFeaturedItemProductIds,
} from "@/lib/platform-all-page-featured";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";
import { STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE } from "@/lib/storefront-listing-product-include";
import {
  PUBLIC_STOREFRONT_CACHE_TAG,
  PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
} from "@/lib/public-storefront-cache";

const TOP_SHOPS_HOME_DEFAULT = 10;
const TOP_SHOPS_HOME_FETCH_CAP = 250;

const HOT_WINDOW_DAYS = 30;

const homeHotCarouselProductInclude = STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE;

/** Shops with a home featured listing + profile, for the platform home carousel. */
async function getFeaturedCreatorShopsForHomeUncached() {
  return prisma.shop.findMany({
    where: {
      active: true,
      listedOnShopsBrowse: true,
      slug: { not: PLATFORM_SHOP_SLUG },
      homeFeaturedListing: {
        is: {
          active: true,
          creatorRemovedFromShopAt: null,
          product: { active: true },
        },
      },
    },
    include: {
      homeFeaturedListing: {
        include: {
          product: {
            include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE,
          },
        },
      },
    },
    orderBy: [{ editorialPriority: "desc" }, { totalSalesCents: "desc" }],
    take: 8,
  });
}

export async function getFeaturedCreatorShopsForHome() {
  return unstable_cache(
    getFeaturedCreatorShopsForHomeUncached,
    ["marketplace-home-featured-shops-v1"],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [PUBLIC_STOREFRONT_CACHE_TAG],
    },
  )();
}

/**
 * Creator shops for the home “Top shops” strip: same ranking as /shops default (editorial pin,
 * `editorialPriority`, then `totalSalesCents`). Admins influence order via those fields (+ paid
 * promos later can reuse `editorialPriority`).
 */
async function getTopShopsForHomeUncached(limit = TOP_SHOPS_HOME_DEFAULT) {
  const raw = await prisma.shop.findMany({
    where: {
      active: true,
      listedOnShopsBrowse: true,
      slug: { not: PLATFORM_SHOP_SLUG },
    },
    select: {
      id: true,
      slug: true,
      displayName: true,
      profileImageUrl: true,
      bio: true,
      totalSalesCents: true,
      editorialPriority: true,
      editorialPinnedUntil: true,
      createdAt: true,
    },
    take: TOP_SHOPS_HOME_FETCH_CAP,
  });
  const sorted = sortShopsForBrowse(raw, "editorial");
  return sorted.slice(0, limit);
}

export async function getTopShopsForHome(limit = TOP_SHOPS_HOME_DEFAULT) {
  return unstable_cache(
    () => getTopShopsForHomeUncached(limit),
    ["marketplace-home-top-shops-v1", String(limit)],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [PUBLIC_STOREFRONT_CACHE_TAG],
    },
  )();
}

/**
 * Marketing home “Hot items” carousel:
 *
 * - **Manual list** (`homeHotCarouselFeaturedProductIds`): show those products in saved order (up to
 *   {@link HOME_HOT_CAROUSEL_MAX_ITEMS}).
 * - **Otherwise**: active **Hot item** paid placements (newest first), then highest
 *   `storefrontViewCount`, then any live marketplace listing (default count
 *   {@link HOME_HOT_CAROUSEL_DEFAULT_DISPLAY}).
 */
async function getHomeHotCarouselProductsUncached(
  displayLimit = HOME_HOT_CAROUSEL_DEFAULT_DISPLAY,
): Promise<ProductCardProduct[]> {
  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { homeHotCarouselFeaturedProductIds: true },
  });
  const adminIds = parseShopOrderedFeaturedProductIds(
    platform?.homeHotCarouselFeaturedProductIds ?? null,
    { max: HOME_HOT_CAROUSEL_MAX_ITEMS },
  );
  const used = new Set<string>();
  const listingOut: Parameters<typeof productCardProductsFromListings>[0] = [];

  const manualCap = Math.min(
    Math.max(displayLimit, adminIds.length),
    HOME_HOT_CAROUSEL_MAX_ITEMS,
  );

  if (adminIds.length > 0) {
    const rows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        productId: { in: adminIds },
        product: { active: true },
      },
      orderBy: { createdAt: "asc" },
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    const byPid = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      if (!byPid.has(r.productId)) byPid.set(r.productId, r);
    }
    for (const pid of adminIds) {
      if (listingOut.length >= manualCap) break;
      const row = byPid.get(pid);
      if (row) {
        listingOut.push(row);
        used.add(pid);
      }
    }
    return productCardProductsFromListings(listingOut);
  }

  const promoIds = await getOrderedHotFeaturedItemProductIds();
  if (promoIds.length > 0) {
    const rows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        productId: { in: promoIds },
        product: { active: true },
      },
      orderBy: { createdAt: "asc" },
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    const byPid = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      if (!byPid.has(r.productId)) byPid.set(r.productId, r);
    }
    for (const pid of promoIds) {
      if (listingOut.length >= displayLimit) break;
      const row = byPid.get(pid);
      if (row && !used.has(pid)) {
        listingOut.push(row);
        used.add(pid);
      }
    }
  }

  const needViews = displayLimit - listingOut.length;
  if (needViews > 0) {
    const exclude = [...used];
    const viewedRows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
        },
      },
      orderBy: { product: { storefrontViewCount: "desc" } },
      take: needViews + 80,
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    for (const row of viewedRows) {
      if (listingOut.length >= displayLimit) break;
      if (used.has(row.productId)) continue;
      used.add(row.productId);
      listingOut.push(row);
    }
  }

  const needAny = displayLimit - listingOut.length;
  if (needAny > 0) {
    const exclude = [...used];
    const anyRows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: needAny + 100,
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    for (const row of anyRows) {
      if (listingOut.length >= displayLimit) break;
      if (used.has(row.productId)) continue;
      used.add(row.productId);
      listingOut.push(row);
    }
  }

  return productCardProductsFromListings(listingOut);
}

export async function getHomeHotCarouselProducts(
  displayLimit = HOME_HOT_CAROUSEL_DEFAULT_DISPLAY,
): Promise<ProductCardProduct[]> {
  return unstable_cache(
    () => getHomeHotCarouselProductsUncached(displayLimit),
    ["marketplace-home-hot-carousel-v1", String(displayLimit)],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [PUBLIC_STOREFRONT_CACHE_TAG],
    },
  )();
}

/**
 * Marketing home “Popular items” carousel:
 *
 * - **Manual list** (`popularItemsFeaturedProductIds`): show those products in saved order (up to
 *   {@link HOME_HOT_CAROUSEL_MAX_ITEMS}).
 * - **Otherwise**: active **Popular item** paid placements (newest first), then highest
 *   `storefrontViewCount`, then any live marketplace listing (default count
 *   {@link HOME_HOT_CAROUSEL_DEFAULT_DISPLAY}).
 */
async function getHomePopularCarouselProductsUncached(
  displayLimit = HOME_HOT_CAROUSEL_DEFAULT_DISPLAY,
): Promise<ProductCardProduct[]> {
  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { popularItemsFeaturedProductIds: true },
  });
  const adminIds = parseShopOrderedFeaturedProductIds(
    platform?.popularItemsFeaturedProductIds ?? null,
    { max: HOME_HOT_CAROUSEL_MAX_ITEMS },
  );
  const used = new Set<string>();
  const listingOut: Parameters<typeof productCardProductsFromListings>[0] = [];

  const manualCap = Math.min(
    Math.max(displayLimit, adminIds.length),
    HOME_HOT_CAROUSEL_MAX_ITEMS,
  );

  if (adminIds.length > 0) {
    const rows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        productId: { in: adminIds },
        product: { active: true },
      },
      orderBy: { createdAt: "asc" },
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    const byPid = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      if (!byPid.has(r.productId)) byPid.set(r.productId, r);
    }
    for (const pid of adminIds) {
      if (listingOut.length >= manualCap) break;
      const row = byPid.get(pid);
      if (row) {
        listingOut.push(row);
        used.add(pid);
      }
    }
    return productCardProductsFromListings(listingOut);
  }

  const promoIds = await getOrderedPopularFeaturedItemProductIds();
  if (promoIds.length > 0) {
    const rows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        productId: { in: promoIds },
        product: { active: true },
      },
      orderBy: { createdAt: "asc" },
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    const byPid = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      if (!byPid.has(r.productId)) byPid.set(r.productId, r);
    }
    for (const pid of promoIds) {
      if (listingOut.length >= displayLimit) break;
      const row = byPid.get(pid);
      if (row && !used.has(pid)) {
        listingOut.push(row);
        used.add(pid);
      }
    }
  }

  const needViews = displayLimit - listingOut.length;
  if (needViews > 0) {
    const exclude = [...used];
    const viewedRows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
        },
      },
      orderBy: { product: { storefrontViewCount: "desc" } },
      take: needViews + 80,
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    for (const row of viewedRows) {
      if (listingOut.length >= displayLimit) break;
      if (used.has(row.productId)) continue;
      used.add(row.productId);
      listingOut.push(row);
    }
  }

  const needAny = displayLimit - listingOut.length;
  if (needAny > 0) {
    const exclude = [...used];
    const anyRows = await prisma.shopListing.findMany({
      where: {
        ...marketplaceAggregatedListingWhere,
        product: {
          active: true,
          ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: needAny + 100,
      include: {
        product: { include: homeHotCarouselProductInclude },
        shop: { select: { slug: true } },
      },
    });
    for (const row of anyRows) {
      if (listingOut.length >= displayLimit) break;
      if (used.has(row.productId)) continue;
      used.add(row.productId);
      listingOut.push(row);
    }
  }

  return productCardProductsFromListings(listingOut);
}

export async function getHomePopularCarouselProducts(
  displayLimit = HOME_HOT_CAROUSEL_DEFAULT_DISPLAY,
): Promise<ProductCardProduct[]> {
  return unstable_cache(
    () => getHomePopularCarouselProductsUncached(displayLimit),
    ["marketplace-home-popular-carousel-v1", String(displayLimit)],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [PUBLIC_STOREFRONT_CACHE_TAG],
    },
  )();
}

/** Top-selling products (by paid order line quantity) in the last window; creator live listings. */
async function getHotListingProductsForHomeUncached(
  limit = 10,
): Promise<ProductCardProduct[]> {
  const since = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const grouped = await prisma.orderLine.groupBy({
    by: ["productId"],
    where: {
      order: { status: OrderStatus.paid, createdAt: { gte: since } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.productId);
  const listings = await prisma.shopListing.findMany({
    where: {
      ...marketplaceAggregatedListingWhere,
      productId: { in: ids },
      product: { active: true },
    },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE,
      },
      shop: { select: { slug: true, displayName: true } },
    },
  });
  const byProduct = new Map<string, (typeof listings)[0]>();
  for (const l of listings) {
    if (!byProduct.has(l.productId)) byProduct.set(l.productId, l);
  }
  const listingOut: Parameters<typeof productCardProductsFromListings>[0] = [];
  for (const g of grouped) {
    const row = byProduct.get(g.productId);
    if (row) listingOut.push(row);
  }
  return productCardProductsFromListings(listingOut);
}

export async function getHotListingProductsForHome(
  limit = 10,
): Promise<ProductCardProduct[]> {
  return unstable_cache(
    () => getHotListingProductsForHomeUncached(limit),
    ["marketplace-home-hot-listing-products-v1", String(limit)],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [PUBLIC_STOREFRONT_CACHE_TAG],
    },
  )();
}
