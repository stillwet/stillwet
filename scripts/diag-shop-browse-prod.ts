import { config } from "dotenv";

config({ path: ".env.production.local", override: true });
config({ path: ".env", override: true });

const shopSlugArg = process.argv[2]?.trim() ?? "stillwet-shop";

async function main() {
  const { ensurePrismaClient } = await import("../src/lib/prisma");
  const { STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE } = await import(
    "../src/lib/storefront-listing-product-include"
  );
  const { storefrontShopListingWhere } = await import(
    "../src/lib/shop-listing-storefront-visibility"
  );
  const { SHOP_ALL_FEATURED_POOL_LIMIT, SHOP_ALL_PAGE_SIZE } = await import(
    "../src/lib/shop-all-browse-query"
  );
  const { shopListingPopularItemPromotionPurchasesArgs } = await import(
    "../src/lib/shop-listing-browse-promotion-sort"
  );
  const { fetchPopularBrowsePageSlice } = await import(
    "../src/lib/shop-listing-popular-browse-paginated"
  );
  const { buyerSalesShopConnectPrismaWhere } = await import(
    "../src/lib/shop-stripe-connect-gate"
  );

  const prisma = ensurePrismaClient();
  const listingIncludeBase = {
    product: { include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE },
    shop: { select: { slug: true, displayName: true } },
  } as const;

  const shop = await prisma.shop.findFirst({
    where: { slug: shopSlugArg, active: true },
    select: {
      id: true,
      slug: true,
      displayName: true,
      stripeConnectAccountId: true,
      connectChargesEnabled: true,
    },
  });
  if (!shop) {
    console.error("Shop not found:", shopSlugArg);
    process.exit(1);
  }
  console.log("Shop:", shop);

  const shopWhereBase = {
    shopId: shop.id,
    ...storefrontShopListingWhere,
    product: { active: true },
    shop: {
      slug: shop.slug,
      active: true,
      ...buyerSalesShopConnectPrismaWhere(),
    },
  };

  const carousel = await prisma.shopListing.findMany({
    where: shopWhereBase,
    take: 12,
    orderBy: [{ featuredOnShop: "desc" }, { updatedAt: "desc" }],
    include: {
      product: { include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE },
      shop: { select: { slug: true } },
    },
  });
  console.log("carousel OK", carousel.length);

  const browse = await prisma.shopListing.findMany({
    where: shopWhereBase,
    orderBy: [{ priceCents: "asc" }, { product: { name: "asc" } }],
    skip: 0,
    take: SHOP_ALL_PAGE_SIZE,
    include: listingIncludeBase,
  });
  console.log("browse price OK", browse.length);

  const poolRows = await prisma.shopListing.findMany({
    where: shopWhereBase,
    orderBy: [{ product: { updatedAt: "desc" } }],
    take: SHOP_ALL_FEATURED_POOL_LIMIT,
    include: listingIncludeBase,
  });
  console.log("featured pool OK", poolRows.length);

  const popularInclude = {
    ...listingIncludeBase,
    promotionPurchases: shopListingPopularItemPromotionPurchasesArgs,
  };
  const popular = await fetchPopularBrowsePageSlice({
    where: shopWhereBase,
    pageParam: 1,
    include: popularInclude,
    pageSize: SHOP_ALL_PAGE_SIZE,
  });
  console.log("popular browse OK", popular.rows.length, "total", popular.totalCount);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
