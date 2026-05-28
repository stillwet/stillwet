import type { Prisma } from "@/generated/prisma/client";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { getPlatformHotItemsPrimaryProducts } from "@/lib/platform-hot-items-snapshot";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";

/**
 * Marketplace `/shop/all` “Hot items” strip — loaded inside {@link Suspense} so the browse grid can
 * render first (carousel queries are heavy).
 */
export async function ShopAllHotItemsSection({
  fullWhere,
}: {
  fullWhere: Prisma.ShopListingWhereInput;
}) {
  // Snapshot-only: this carousel is allowed to be stale; avoid heavy live pool queries that can hang `/shop/all`.
  void fullWhere;
  const primary = await getPlatformHotItemsPrimaryProducts();
  const featuredCarouselItems = productsToFeaturedCarouselItems(primary);
  if (featuredCarouselItems.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-2 text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
        Hot items
      </h2>
      <FeaturedProductsCarousel items={featuredCarouselItems} label="Hot items" />
    </section>
  );
}

export function ShopAllHotItemsSkeleton() {
  return (
    <section className="mb-10" aria-busy="true" aria-label="Loading hot items">
      <div className="mx-auto mb-2 h-4 w-24 animate-pulse rounded bg-zinc-800" />
      <div className="mx-auto flex justify-center gap-3 py-4 md:gap-8">
        <div className="hidden h-36 w-36 shrink-0 animate-pulse rounded-lg bg-zinc-800/70 md:block" />
        <div className="h-44 w-44 shrink-0 animate-pulse rounded-xl bg-zinc-800 sm:h-52 sm:w-52" />
        <div className="hidden h-36 w-36 shrink-0 animate-pulse rounded-lg bg-zinc-800/70 md:block" />
      </div>
    </section>
  );
}
