import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MarketplaceEmptyState } from "@/components/MarketplaceEmptyState";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { rethrowNextNavigationError } from "@/lib/next-navigation-errors";
import {
  ShopAllBrowsePagination,
  ShopAllBrowseToolbar,
} from "@/components/ShopAllBrowseToolbar";
import type { ShopAllBrowseSortParam } from "@/lib/shop-all-browse-query";
import { SHOP_ALL_FEATURED_POOL_LIMIT, SHOP_ALL_PAGE_SIZE } from "@/lib/shop-all-browse-query";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ShopAllHotItemsSection, ShopAllHotItemsSkeleton } from "@/components/ShopAllHotItemsSection";
import { ShopPlatformBrowseGrid } from "@/components/ShopPlatformBrowseGrid";
import { getStoreTags, getStoreTagsForShop } from "@/lib/store-tags";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  marketplaceAggregatedListingWhere,
  storefrontShopListingWhere,
} from "@/lib/shop-listing-storefront-visibility";
import { shopListingPopularItemPromotionPurchasesArgs } from "@/lib/shop-listing-browse-promotion-sort";
import {
  fetchPopularBrowsePageSlice,
  fetchPopularBrowsePageSliceSnapshotOnly,
} from "@/lib/shop-listing-popular-browse-paginated";
import { STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE } from "@/lib/storefront-listing-product-include";
import {
  PUBLIC_STOREFRONT_CACHE_TAG,
  PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
  SHOP_BROWSE_SEARCH_REVALIDATE_SECONDS,
  publicShopCacheTag,
} from "@/lib/public-storefront-cache";

const listingIncludeBase = {
  product: { include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE },
  shop: { select: { slug: true, displayName: true } },
} as const;

function withProductTagFilter(
  listingWhere: Prisma.ShopListingWhereInput,
  tagSlug: string,
): Prisma.ShopListingWhereInput {
  const t = tagSlug.trim();
  const tagProduct: Prisma.ProductWhereInput = {
    OR: [
      { primaryTag: { slug: t } },
      { tags: { some: { tag: { slug: t } } } },
    ],
  };
  const inner = listingWhere as { product?: Prisma.ProductWhereInput };
  if (!inner.product) {
    return { ...listingWhere, product: tagProduct };
  }
  return {
    ...listingWhere,
    product: {
      AND: [inner.product, tagProduct],
    },
  };
}

function parseShopAllBrowseSort(
  raw: string | undefined | null,
): ShopAllBrowseSortParam {
  if (raw === "popular" || raw === "new") return raw;
  if (raw === "name") return "price";
  if (raw === "price") return "price";
  return "price";
}

/**
 * Prisma `orderBy` for browse — **Popular** uses {@link fetchPopularBrowsePageSlice}
 * (ranked in app after lightweight maps + SQL revenue); do not pass an order for that mode.
 */
function shopListingBrowsePrismaOrderBy(
  sort: ShopAllBrowseSortParam,
): Prisma.ShopListingOrderByWithRelationInput[] | undefined {
  switch (sort) {
    case "popular":
      return undefined;
    case "new":
      return [{ createdAt: "desc" }];
    case "price":
      return [{ priceCents: "asc" }, { product: { name: "asc" } }];
  }
}

const listingOrderNameAsc: Prisma.ShopListingOrderByWithRelationInput[] = [
  { product: { name: "asc" } },
];

function listingTextSearchWhere(query: string | undefined): Prisma.ShopListingWhereInput {
  const trimmed = query?.trim();
  if (!trimmed) return {};
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};
  const insensitive = "insensitive" as Prisma.QueryMode;
  return {
    AND: tokens.map((t) => ({
      OR: [
        { product: { name: { contains: t, mode: insensitive } } },
        { requestItemName: { contains: t, mode: insensitive } },
        { listingSearchKeywords: { contains: t, mode: insensitive } },
      ],
    })),
  };
}

type ShopListingForCard = Parameters<typeof productCardProductFromListing>[0];

async function loadBrowsePageSlice(args: {
  where: Prisma.ShopListingWhereInput;
  browseSort: ShopAllBrowseSortParam;
  /** 1-based page index from the URL (clamped to valid range). */
  pageParam: number;
  include: Prisma.ShopListingInclude;
  /** Platform `/shop/all` Popular: snapshot-only (daily) instead of live ranking. */
  snapshotOnlyPopular?: boolean;
  cacheKey?: string | null;
}): Promise<{
  rows: ShopListingForCard[];
  totalCount: number;
  /** Clamped page actually shown (for pagination links). */
  displayPage: number;
}> {
  const { where, browseSort, pageParam, include, snapshotOnlyPopular = false, cacheKey = null } = args;

  if (cacheKey) {
    return unstable_cache(
      () => loadBrowsePageSlice({ ...args, cacheKey: null }),
      ["shop-all-browse-slice-v2", cacheKey],
      {
        revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
        tags: [PUBLIC_STOREFRONT_CACHE_TAG],
      },
    )();
  }

  if (browseSort === "popular") {
    if (snapshotOnlyPopular) {
      const popular = await fetchPopularBrowsePageSliceSnapshotOnly({
        pageParam,
        include,
        pageSize: SHOP_ALL_PAGE_SIZE,
        where,
      });
      if (popular.totalCount > 0) {
        return {
          rows: popular.rows as unknown as ShopListingForCard[],
          totalCount: popular.totalCount,
          displayPage: popular.displayPage,
        };
      }
    } else if (cacheKey) {
      const popular = await unstable_cache(
        () =>
          fetchPopularBrowsePageSlice({
            where,
            pageParam,
            include,
            pageSize: SHOP_ALL_PAGE_SIZE,
          }),
        ["shop-popular-browse-v1", cacheKey],
        {
          revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
          tags: [PUBLIC_STOREFRONT_CACHE_TAG],
        },
      )();
      return {
        rows: popular.rows as unknown as ShopListingForCard[],
        totalCount: popular.totalCount,
        displayPage: popular.displayPage,
      };
    } else {
      const popular = await fetchPopularBrowsePageSlice({
        where,
        pageParam,
        include,
        pageSize: SHOP_ALL_PAGE_SIZE,
      });
      return {
        rows: popular.rows as unknown as ShopListingForCard[],
        totalCount: popular.totalCount,
        displayPage: popular.displayPage,
      };
    }
  }

  const load = async () => {
    const totalCount = await prisma.shopListing.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalCount / SHOP_ALL_PAGE_SIZE));
    const displayPage = Math.min(Math.max(1, pageParam), totalPages);
    const skip = (displayPage - 1) * SHOP_ALL_PAGE_SIZE;

    const orderBy = shopListingBrowsePrismaOrderBy(browseSort);
    const rows = await prisma.shopListing.findMany({
      where,
      orderBy: orderBy!,
      skip,
      take: SHOP_ALL_PAGE_SIZE,
      include,
    });
    return {
      rows: rows as unknown as ShopListingForCard[],
      totalCount,
      displayPage,
    };
  };

  return load();
}

function loadCachedShopAllShop(shopSlug: string) {
  return unstable_cache(
    () =>
      prisma.shop.findFirst({
        where: { slug: shopSlug, active: true },
        select: { id: true },
      }),
    ["shop-all-active-shop-v1", shopSlug],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [PUBLIC_STOREFRONT_CACHE_TAG, publicShopCacheTag(shopSlug)],
    },
  )();
}

function loadCachedFeaturedPoolRows(
  where: Prisma.ShopListingWhereInput,
  cacheKey: string | null,
) {
  const load = () =>
    prisma.shopListing.findMany({
      where,
      orderBy: [{ product: { updatedAt: "desc" } }],
      take: SHOP_ALL_FEATURED_POOL_LIMIT,
      include: listingIncludeBase,
    });
  if (!cacheKey) return load();
  return unstable_cache(load, ["shop-all-featured-pool-v1", cacheKey], {
    revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
    tags: [PUBLIC_STOREFRONT_CACHE_TAG],
  })();
}

function loadCachedNameOrderedFeaturedRows(
  where: Prisma.ShopListingWhereInput,
  cacheKey: string | null,
) {
  const load = () =>
    prisma.shopListing.findMany({
      where,
      orderBy: listingOrderNameAsc,
      take: SHOP_ALL_FEATURED_POOL_LIMIT,
      include: listingIncludeBase,
    });
  if (!cacheKey) return load();
  return unstable_cache(load, ["shop-all-name-featured-pool-v1", cacheKey], {
    revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
    tags: [PUBLIC_STOREFRONT_CACHE_TAG],
  })();
}

export async function ShopAllProductsPage({
  shopSlug = PLATFORM_SHOP_SLUG,
  searchQuery,
  browseFlat = false,
  tagSlug,
  browseSort: browseSortParam,
  /** 1-based; omit or 1 = first page. */
  page: pageParam = 1,
  embedded = false,
}: {
  shopSlug?: string;
  /** From `?q=` on `/shop/all` or `/s/[shop]/all`. */
  searchQuery?: string;
  /** From `?flat=1` on `/s/[shop]/all` — single flat grid instead of tag sections. */
  browseFlat?: boolean;
  /** From `?tag=` — primary or secondary tag slug; filters Browse grid only. */
  tagSlug?: string | null;
  /**
   * From `?sort=`: `new` (listing `createdAt` desc), `price` (low → high), `popular` (newest paid
   * “Popular item” promotion, then line revenue, then product views), or default `price`. Legacy
   * `?sort=name` maps to `price`.
   */
  browseSort?: string | null;
  page?: number;
  /** Shop home only: skip “All Items” title and featured carousel; render browse toolbar + grid. */
  embedded?: boolean;
} = {}) {
  try {
  const isPlatformCatalog = shopSlug === PLATFORM_SHOP_SLUG;
  const shopPromise = loadCachedShopAllShop(shopSlug);

  let shop: { id: string };
  let filterTags: Awaited<ReturnType<typeof getStoreTags>>;
  if (browseFlat && !isPlatformCatalog) {
    const s = await shopPromise;
    if (!s) notFound();
    shop = s;
    filterTags = await getStoreTagsForShop(shop.id);
  } else {
    const [s, tags] = await Promise.all([shopPromise, getStoreTags()]);
    if (!s) notFound();
    shop = s;
    filterTags = tags;
  }

  const browseSort = parseShopAllBrowseSort(browseSortParam);
  const searchKey = searchQuery?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  const cacheablePublicBrowse = searchKey.length === 0;

  const listingInclude =
    browseSort === "popular"
      ? {
          ...listingIncludeBase,
          promotionPurchases: shopListingPopularItemPromotionPurchasesArgs,
        }
      : listingIncludeBase;

  let browseProducts: ReturnType<typeof productCardProductFromListing>[];
  let featuredSourceProducts: ReturnType<typeof productCardProductFromListing>[] = [];
  /** Marketplace aggregate scope — passed to deferred Hot items carousel. */
  let platformFullWhere: Prisma.ShopListingWhereInput | undefined;

  const activeTag =
    tagSlug?.trim() &&
    filterTags.some((t) => t.slug === tagSlug.trim())
      ? tagSlug.trim()
      : undefined;

  let browseDisplayPage = pageParam;
  let browseTotalPages = 1;

  const textWhere = listingTextSearchWhere(searchQuery);
  const marketplaceWhereBase: Prisma.ShopListingWhereInput = {
    ...marketplaceAggregatedListingWhere,
    product: { active: true },
  };
  const shopWhereBase: Prisma.ShopListingWhereInput = {
    shopId: shop.id,
    ...storefrontShopListingWhere,
    product: { active: true },
  };

  function withSearch(
    base: Prisma.ShopListingWhereInput,
  ): Prisma.ShopListingWhereInput {
    return Object.keys(textWhere).length === 0 ? base : { AND: [base, textWhere] };
  }

  async function loadBrowseSlice(
    args: Parameters<typeof loadBrowsePageSlice>[0],
  ): ReturnType<typeof loadBrowsePageSlice> {
    if (searchKey.length === 0) {
      return loadBrowsePageSlice(args);
    }
    const searchCacheKey = [
      "shop-browse-search-v1",
      shopSlug,
      searchKey,
      activeTag ?? "all",
      browseSort,
      String(pageParam),
    ].join(":");
    return unstable_cache(
      () => loadBrowsePageSlice({ ...args, cacheKey: null }),
      [searchCacheKey],
      {
        revalidate: SHOP_BROWSE_SEARCH_REVALIDATE_SECONDS,
        tags: [PUBLIC_STOREFRONT_CACHE_TAG],
      },
    )();
  }

    if (isPlatformCatalog) {
      const fullWhere = withSearch(marketplaceWhereBase);
      platformFullWhere = fullWhere;
      const browseWhere =
        activeTag != null ? withProductTagFilter(fullWhere, activeTag) : fullWhere;

      const browseSlice = await loadBrowseSlice({
        where: browseWhere,
        browseSort,
        pageParam,
        include: listingInclude,
        snapshotOnlyPopular: browseSort === "popular",
        cacheKey: cacheablePublicBrowse
          ? `platform:${activeTag ?? "all"}:${browseSort}:${pageParam}`
          : null,
      });
      browseDisplayPage = browseSlice.displayPage;
      browseTotalPages = Math.max(
        1,
        Math.ceil(browseSlice.totalCount / SHOP_ALL_PAGE_SIZE),
      );

      browseProducts = browseSlice.rows.map((l) => productCardProductFromListing(l));
    } else if (browseFlat) {
      const base = withSearch(shopWhereBase);
      const where =
        activeTag != null ? withProductTagFilter(base, activeTag) : base;

      const [browseSlice, poolRows] = await Promise.all([
        loadBrowseSlice({
          where,
          browseSort,
          pageParam,
          include: listingInclude,
          cacheKey: cacheablePublicBrowse
            ? `shop-flat:${shopSlug}:${activeTag ?? "all"}:${browseSort}:${pageParam}`
            : null,
        }),
        loadCachedFeaturedPoolRows(
          where,
          cacheablePublicBrowse
            ? `shop-flat:${shopSlug}:${activeTag ?? "all"}:featured`
            : null,
        ),
      ]);
      browseDisplayPage = browseSlice.displayPage;
      browseTotalPages = Math.max(
        1,
        Math.ceil(browseSlice.totalCount / SHOP_ALL_PAGE_SIZE),
      );

      browseProducts = browseSlice.rows.map((l) => productCardProductFromListing(l));
      featuredSourceProducts = poolRows.map((l) => productCardProductFromListing(l));
    } else {
      const shopFeaturedWhere = withSearch(shopWhereBase);
      const shopListings = await loadCachedNameOrderedFeaturedRows(
        shopFeaturedWhere,
        cacheablePublicBrowse ? `shop-mixed:${shopSlug}:featured` : null,
      );
      featuredSourceProducts = shopListings.map((l) =>
        productCardProductFromListing(l),
      );

      const mBase = withSearch(marketplaceWhereBase);
      const mWhere =
        activeTag != null ? withProductTagFilter(mBase, activeTag) : mBase;

      const browseSlice = await loadBrowseSlice({
        where: mWhere,
        browseSort,
        pageParam,
        include: listingInclude,
        cacheKey: cacheablePublicBrowse
          ? `shop-mixed:${shopSlug}:${activeTag ?? "all"}:${browseSort}:${pageParam}`
          : null,
      });
      browseDisplayPage = browseSlice.displayPage;
      browseTotalPages = Math.max(
        1,
        Math.ceil(browseSlice.totalCount / SHOP_ALL_PAGE_SIZE),
      );

      browseProducts = browseSlice.rows.map((l) => productCardProductFromListing(l));
    }
  const featuredCarouselItems = !isPlatformCatalog
    ? productsToFeaturedCarouselItems(featuredSourceProducts)
    : [];
  const featuredDefaultListingShopSlug =
    shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug;

  const toolbarTags = filterTags.map((t) => ({ slug: t.slug, name: t.name }));

  let marketplaceEmptyStats: { creatorShops: number; liveListings: number } | undefined;
  if (browseProducts.length === 0 && !searchQuery?.trim() && isPlatformCatalog) {
    const [creatorShops, liveListings] = await Promise.all([
      prisma.shop.count({
        where: { active: true, slug: { not: PLATFORM_SHOP_SLUG } },
      }),
      prisma.shopListing.count({
        where: {
          ...marketplaceAggregatedListingWhere,
          product: { active: true },
        },
      }),
    ]);
    marketplaceEmptyStats = { creatorShops, liveListings };
  }

  return (
    <div>
      {!embedded ? (
        <div className="mb-8">
          <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
            All Items
          </h1>
        </div>
      ) : null}

      {!embedded && isPlatformCatalog && platformFullWhere ? (
        <Suspense fallback={<ShopAllHotItemsSkeleton />}>
          <ShopAllHotItemsSection fullWhere={platformFullWhere} />
        </Suspense>
      ) : null}

      {!embedded && !isPlatformCatalog && featuredCarouselItems.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-2 text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
            Featured
          </h2>
          <FeaturedProductsCarousel
            items={featuredCarouselItems}
            label="Featured products"
            defaultListingShopSlug={featuredDefaultListingShopSlug}
          />
        </section>
      ) : null}

      <section
        className={
          embedded
            ? "mt-10 sm:mt-12"
            : isPlatformCatalog
              ? "mt-2"
              : undefined
        }
      >
        <ShopAllBrowseToolbar
          shopSlug={shopSlug}
          tags={toolbarTags}
          selectedTagSlug={activeTag}
          selectedSort={browseSort}
          searchQuery={searchQuery}
          browseFlat={!isPlatformCatalog && browseFlat}
        />
        <ShopPlatformBrowseGrid
          shopSlug={!isPlatformCatalog && browseFlat ? shopSlug : undefined}
          showShopName={
            isPlatformCatalog ? true : browseFlat ? false : true
          }
          products={browseProducts}
          emptyState={
            searchQuery?.trim() ? (
              <MarketplaceEmptyState variant="search-results" searchQuery={searchQuery} />
            ) : isPlatformCatalog ? (
              <MarketplaceEmptyState
                variant="marketplace-listings"
                stats={marketplaceEmptyStats}
              >
                <p>
                  Browse only includes creator shops with active products and storefront-visible
                  listings. Dashboard “Live” can show more — check shop activation and product status
                  if you expected items here.
                </p>
              </MarketplaceEmptyState>
            ) : (
              <MarketplaceEmptyState variant="shop-listings" />
            )
          }
        />
        <ShopAllBrowsePagination
          shopSlug={shopSlug}
          selectedTagSlug={activeTag}
          selectedSort={browseSort}
          searchQuery={searchQuery}
          browseFlat={!isPlatformCatalog && browseFlat}
          currentPage={browseDisplayPage}
          totalPages={browseTotalPages}
        />
      </section>
    </div>
  );
  } catch (e) {
    rethrowNextNavigationError(e);
    console.error("[ShopAllProductsPage]", e);
    return <ShopDataLoadError cause={e} />;
  }
}
