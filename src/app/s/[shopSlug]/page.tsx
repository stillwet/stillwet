import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FeaturedProductsCarousel } from "@/components/FeaturedProductsCarousel";
import { productsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { productCardProductFromListing } from "@/lib/shop-listing-product";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { ShopSocialLinksRow } from "@/components/ShopSocialLinksRow";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { ShopStorefrontViewBeacon } from "@/components/ShopStorefrontViewBeacon";
import { ShopAllProductsPage } from "@/components/ShopAllProductsPage";
import { parseShopAllPageParam } from "@/lib/shop-all-browse-query";
import { ShopFlairBadge } from "@/components/ShopFlairBadge";
import { STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE } from "@/lib/storefront-listing-product-include";
import { buyerSalesShopConnectPrismaWhere } from "@/lib/shop-stripe-connect-gate";
import { resolveShopStorefrontPreviewContext } from "@/lib/shop-storefront-owner-preview";

type Props = {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const loadCachedShopTenantHomeMeta = (shopSlug: string) =>
  unstable_cache(
    async () => {
      const shop = await prisma.shop.findFirst({
        where: { slug: shopSlug, active: true },
        include: {
          flairType: true,
          homeFeaturedListing: {
            include: {
              product: {
                include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE,
              },
            },
          },
        },
      });
      if (!shop) return null;
      return { shop };
    },
    ["shop-tenant-home-meta-v1", shopSlug],
    { revalidate: 10 * 60 },
  )();

async function loadShopTenantHomeListings(
  shopSlug: string,
  shopId: string,
  ownerPreview: boolean,
) {
  const connectWhere = ownerPreview ? {} : buyerSalesShopConnectPrismaWhere();
  return prisma.shopListing.findMany({
    where: {
      shopId,
      ...storefrontShopListingWhere,
      product: { active: true },
      shop: {
        slug: shopSlug,
        active: true,
        ...connectWhere,
      },
    },
    take: 12,
    orderBy: [{ featuredOnShop: "desc" }, { updatedAt: "desc" }],
    include: {
      product: {
        include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE,
      },
      shop: { select: { slug: true } },
    },
  });
}

export default async function ShopTenantHomePage({ params, searchParams }: Props) {
  const { shopSlug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  const sort = typeof sp.sort === "string" ? sp.sort : undefined;
  const browsePage = parseShopAllPageParam(sp.page);
  let loaded;
  try {
    loaded = await loadCachedShopTenantHomeMeta(shopSlug);
  } catch (e) {
    return <ShopDataLoadError cause={e} />;
  }
  if (!loaded) notFound();
  const { shop } = loaded;

  const previewContext =
    shop.slug === PLATFORM_SHOP_SLUG
      ? { isOwnerPreview: false, connectReadyForBuyerSales: true, showConnectNotLiveBanner: false }
      : await resolveShopStorefrontPreviewContext(shopSlug, shop);

  let listings;
  try {
    listings =
      previewContext.connectReadyForBuyerSales || previewContext.isOwnerPreview
        ? await loadShopTenantHomeListings(
            shopSlug,
            shop.id,
            previewContext.isOwnerPreview,
          )
        : [];
  } catch (e) {
    return <ShopDataLoadError cause={e} />;
  }

  const showFeaturedListing =
    previewContext.connectReadyForBuyerSales || previewContext.isOwnerPreview;
  const featuredList =
    showFeaturedListing &&
    shop.homeFeaturedListing?.product &&
    shop.homeFeaturedListing.active &&
    shop.homeFeaturedListing.creatorRemovedFromShopAt == null &&
    shop.homeFeaturedListing.product.active
      ? [
          productCardProductFromListing({
            id: shop.homeFeaturedListing.id,
            shopId: shop.homeFeaturedListing.shopId,
            priceCents: shop.homeFeaturedListing.priceCents,
            product: shop.homeFeaturedListing.product,
            requestItemName: shop.homeFeaturedListing.requestItemName,
            adminListingSecondaryImageUrl: shop.homeFeaturedListing.adminListingSecondaryImageUrl,
            ownerSupplementImageUrl: shop.homeFeaturedListing.ownerSupplementImageUrl,
            listingStorefrontCatalogImageUrls: shop.homeFeaturedListing.listingStorefrontCatalogImageUrls,
            shop: { slug: shopSlug },
          }),
        ]
      : [];

  const carouselProducts = listings.map((l) => productCardProductFromListing(l));

  return (
    <div>
      {shop.slug !== PLATFORM_SHOP_SLUG ? <ShopStorefrontViewBeacon shopSlug={shop.slug} /> : null}
      <div className="mb-10 text-center">
        {shop.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.profileImageUrl}
            alt=""
            className="mx-auto h-28 w-28 rounded-full border border-zinc-700 object-cover"
          />
        ) : (
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm text-zinc-500">
            Shop
          </div>
        )}
        <h1 className="store-dimension-page-title mt-4 text-3xl text-zinc-50">
          {shop.displayName}
        </h1>
        {shop.flairType && shop.flairPurchasedAt ? (
          <div className="mt-2 flex justify-center">
            <ShopFlairBadge
              label={shop.flairType.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-zinc-950/30 px-3 py-1 text-xs font-medium text-zinc-200"
            />
          </div>
        ) : null}
        {shop.welcomeMessage?.trim() ? (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-300">
            {shop.welcomeMessage.trim()}
          </p>
        ) : null}
        {shop.bio ? (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">{shop.bio}</p>
        ) : null}
        <ShopSocialLinksRow raw={shop.socialLinks} />
      </div>

      {featuredList.length > 0 ? (
        <section className="mb-12">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Featured
          </h2>
          <FeaturedProductsCarousel
            items={productsToFeaturedCarouselItems(featuredList)}
            label={`Featured at ${shop.displayName}`}
            defaultListingShopSlug={shopSlug}
          />
        </section>
      ) : null}

      {carouselProducts.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Highlights
          </h2>
          <FeaturedProductsCarousel
            items={productsToFeaturedCarouselItems(carouselProducts)}
            label="Featured items"
            defaultListingShopSlug={shopSlug}
          />
        </section>
      ) : featuredList.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">
          Listings will appear here once this shop is stocked.
        </p>
      ) : null}

      {shop.slug !== PLATFORM_SHOP_SLUG ? (
        <ShopAllProductsPage
          shopSlug={shopSlug}
          embedded
          browseFlat
          searchQuery={q}
          tagSlug={tag}
          browseSort={sort}
          page={browsePage}
          storefrontOwnerPreview={previewContext.isOwnerPreview}
        />
      ) : null}
    </div>
  );
}
