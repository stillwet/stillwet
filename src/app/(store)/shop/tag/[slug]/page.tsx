import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreTags } from "@/lib/store-tags";
import { ProductCard } from "@/components/ProductCard";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { productCardProductsFromListings } from "@/lib/shop-listing-product";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE } from "@/lib/storefront-listing-product-include";
import {
  PUBLIC_STOREFRONT_CACHE_TAG,
  PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
} from "@/lib/public-storefront-cache";

type Props = { params: Promise<{ slug: string }> };

const loadCachedTagListings = (tagId: string) =>
  unstable_cache(
    () =>
      prisma.shopListing.findMany({
        where: {
          ...marketplaceAggregatedListingWhere,
          product: {
            active: true,
            OR: [
              { primaryTagId: tagId },
              { tags: { some: { tagId } } },
            ],
          },
        },
        orderBy: { product: { name: "asc" } },
        include: {
          product: { include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE },
          shop: { select: { slug: true } },
        },
      }),
    ["shop-tag-listings-v1", tagId],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [PUBLIC_STOREFRONT_CACHE_TAG],
    },
  )();

export default async function ShopUniversalTagPage({ params }: Props) {
  const { slug } = await params;
  const tags = await getStoreTags();
  let activeTag = tags.find((t) => t.slug === slug) ?? null;
  if (!activeTag) {
    try {
      const t = await prisma.tag.findUnique({ where: { slug } });
      if (!t) notFound();
      activeTag = t;
    } catch (e) {
      console.error("[ShopUniversalTagPage] resolve tag", e);
      return <ShopDataLoadError cause={e} />;
    }
  }

  let listings;
  try {
    listings = await loadCachedTagListings(activeTag.id);
  } catch (e) {
    console.error("[ShopUniversalTagPage] listings", e);
    return <ShopDataLoadError cause={e} />;
  }

  const cardProducts = await productCardProductsFromListings(listings);

  return (
    <div>
      <p className="text-xs text-zinc-500">
        <Link href={SHOP_ALL_ROUTE} className="hover:text-blue-400/90">
          All products
        </Link>
        <span className="mx-1.5 text-zinc-600">/</span>
        <span className="text-zinc-400">{activeTag.name}</span>
      </p>
      <h1 className="store-dimension-page-title mt-2 text-2xl !uppercase !tracking-[0.12em] text-zinc-50">
        {activeTag.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Live creator listings with this tag.</p>

      {listings.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600">No products with this tag yet.</p>
      ) : (
        <ul className="mx-auto mt-8 flex max-w-full flex-wrap justify-center gap-3">
          {cardProducts.map((product, i) => (
            <li key={listings[i]!.id} className="w-[175px] shrink-0">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
