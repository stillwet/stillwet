import type { ReactNode } from "react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  getShopsBrowsePageFeaturedCarouselShops,
} from "@/lib/shops-browse-page-featured";
import { SHOPS_BROWSE_PAGE_FEATURED_DEFAULT_DISPLAY } from "@/lib/platform-all-page-featured-constants";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { ShopBrowseGrid } from "@/components/ShopBrowseGrid";
import { shopsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import {
  parseShopBrowseSort,
  sortShopsForBrowse,
  type ShopBrowseSort,
} from "@/lib/shops-browse";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";

/** First N featured shops on `/shops` (matches {@link SHOPS_BROWSE_PAGE_FEATURED_DEFAULT_DISPLAY}). */
const TOP_SHOPS_PREVIEW_COUNT = SHOPS_BROWSE_PAGE_FEATURED_DEFAULT_DISPLAY;

const loadCachedShopFlairTypesForBrowse = unstable_cache(
  () =>
    prisma.shopFlairType.findMany({
      where: {
        active: true,
        shops: {
          some: {
            active: true,
            listedOnShopsBrowse: true,
            slug: { not: PLATFORM_SHOP_SLUG },
            flairPurchasedAt: { not: null },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, slug: true, label: true },
    }),
  ["shops-browse-flair-types-v1"],
  { revalidate: 15 * 60 },
);

const loadCachedShopsBrowseRows = unstable_cache(
  () =>
    prisma.shop.findMany({
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
        flairPurchasedAt: true,
        flairType: { select: { label: true, slug: true, active: true } },
        totalSalesCents: true,
        editorialPriority: true,
        editorialPinnedUntil: true,
        createdAt: true,
      },
    }),
  ["shops-browse-rows-v1"],
  { revalidate: 15 * 60 },
);

type PageProps = {
  searchParams: Promise<{ sort?: string; flair?: string; flairType?: string }>;
};

function sortHref(next: ShopBrowseSort): string {
  if (next === "sales") return "/shops";
  return `/shops?sort=${next}`;
}

function shopsBrowseHref(args: {
  sort?: ShopBrowseSort;
  flair?: boolean;
  flairType?: string | null;
}): string {
  const p = new URLSearchParams();
  if (args.sort && args.sort !== "sales") p.set("sort", args.sort);
  if (args.flair) p.set("flair", "1");
  if (args.flairType) p.set("flairType", args.flairType);
  const q = p.toString();
  return q ? `/shops?${q}` : "/shops";
}

function SortPill(props: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  const { href, active, children } = props;
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-blue-500/50 bg-blue-950/40 text-blue-100"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function ShopsBrowsePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sort = parseShopBrowseSort(typeof sp.sort === "string" ? sp.sort : undefined);
  const flairToggle = sp.flair === "1";
  const flairTypeSlug = typeof sp.flairType === "string" && sp.flairType.trim() ? sp.flairType.trim() : null;
  const showFlairFilters = flairToggle || Boolean(flairTypeSlug);

  const flairTypes = showFlairFilters ? await loadCachedShopFlairTypesForBrowse() : [];

  let raw;
  try {
    raw = (await loadCachedShopsBrowseRows()).filter((s) =>
      flairTypeSlug
        ? s.flairPurchasedAt && s.flairType?.active && s.flairType.slug === flairTypeSlug
        : true,
    );
  } catch (e) {
    return <ShopDataLoadError cause={e} />;
  }

  const shops = sortShopsForBrowse(raw, sort);

  let featuredRows = shops.slice(0, TOP_SHOPS_PREVIEW_COUNT).map((s) => ({
    slug: s.slug,
    displayName: s.displayName,
    profileImageUrl: s.profileImageUrl,
  }));
  try {
    const rows = await getShopsBrowsePageFeaturedCarouselShops(TOP_SHOPS_PREVIEW_COUNT);
    featuredRows = rows.map((s) => ({
      slug: s.slug,
      displayName: s.displayName,
      profileImageUrl: s.profileImageUrl,
    }));
  } catch (e) {
    console.warn("[shops] featured shops load failed; falling back to browse sort", e);
  }

  const gridShops = shops.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    profileImageUrl: s.profileImageUrl,
    bio: s.bio,
    flair:
      s.flairPurchasedAt && s.flairType ? { label: s.flairType.label } : null,
  }));
  const featuredCarouselItems = shopsToFeaturedCarouselItems(featuredRows, {
    limit: TOP_SHOPS_PREVIEW_COUNT,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-[996px] flex-col px-4 py-12">
      <div className="mb-8">
        <h1 className="store-dimension-page-title text-2xl !uppercase !tracking-[0.12em] text-zinc-50 sm:text-3xl">
          Creator shops
        </h1>
        <p className="mt-2 max-w-lg text-sm text-zinc-500">See what other creators are up to</p>
      </div>

      {gridShops.length === 0 ? (
        <section className="mt-2">
          <p className="text-sm text-zinc-600">
            No shops yet —{" "}
            <Link href="/create-shop" className="text-blue-400 hover:underline">
              create the first one
            </Link>
            .
          </p>
        </section>
      ) : (
        <>
          <section className="mt-2">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Featured shops
            </h2>
            <FeaturedProductsCarousel items={featuredCarouselItems} label="Featured shops" compact />
          </section>
          <section className="mt-12 border-t border-zinc-800/80 pt-10">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">All shops</h2>
            <div className="mb-6 flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                Sort
              </span>
              <SortPill href={sortHref("sales")} active={sort === "sales"}>
                Sales
              </SortPill>
              <SortPill href={sortHref("new")} active={sort === "new"}>
                New
              </SortPill>
              <SortPill
                href={shopsBrowseHref({ sort, flair: !showFlairFilters, flairType: null })}
                active={showFlairFilters}
              >
                Flair
              </SortPill>
            </div>
            {showFlairFilters ? (
              <div className="mb-6 flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                  Filter
                </span>
                <SortPill href={shopsBrowseHref({ sort, flair: true, flairType: null })} active={!flairTypeSlug}>
                  All
                </SortPill>
                {flairTypes.map((t) => (
                  <SortPill
                    key={t.id}
                    href={shopsBrowseHref({ sort, flair: true, flairType: t.slug })}
                    active={flairTypeSlug === t.slug}
                  >
                    {t.label}
                  </SortPill>
                ))}
              </div>
            ) : null}
            <ShopBrowseGrid shops={gridShops} />
          </section>
        </>
      )}

      <p className="mt-12 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Platform home
        </Link>
      </p>

      <SiteLegalFooter />
    </main>
  );
}
