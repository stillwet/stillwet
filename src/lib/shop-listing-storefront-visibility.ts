import type { Prisma } from "@/generated/prisma/client";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { buyerSalesShopConnectPrismaWhere } from "@/lib/shop-stripe-connect-gate";

/**
 * Listings eligible for the public creator storefront and cart resolution (`/s/...`).
 * Creators who remove a listing set `creatorRemovedFromShopAt` and `active: false`.
 */
export const storefrontShopListingWhere = {
  active: true,
  creatorRemovedFromShopAt: null,
  /** Admin “frozen” listings must not sell or appear publicly. */
  adminRemovedFromShopAt: null,
  /** Account-deletion pipeline hides storefront rows before full cleanup. */
  hiddenStorefrontForAccountDeletionAt: null,
} as const;

function marketplaceCreatorShopWhere(): Prisma.ShopWhereInput {
  return {
    slug: { not: PLATFORM_SHOP_SLUG },
    active: true,
    ...buyerSalesShopConnectPrismaWhere(),
  };
}

/**
 * Live listings on **creator** shops only — used for marketplace-wide `/shop/all`, `/shop/tag/…`,
 * and related aggregates. The seeded `platform` shop row is not a storefront catalog.
 * When `MARKETPLACE_STRIPE_CONNECT=1`, only Connect-ready shops are included.
 */
export const marketplaceAggregatedListingWhere = {
  ...storefrontShopListingWhere,
  shop: marketplaceCreatorShopWhere(),
} as const;

/** Shops eligible on `/shops` browse when Connect is required. */
export function shopsBrowseVisibleShopWhere(): Prisma.ShopWhereInput {
  return {
    active: true,
    listedOnShopsBrowse: true,
    slug: { not: PLATFORM_SHOP_SLUG },
    ...buyerSalesShopConnectPrismaWhere(),
  };
}

/** Tenant `/s/[slug]` listing queries for buyers (Connect-ready shops only when required). */
export function tenantStorefrontListingWhereForBuyers(
  shopSlug: string,
): Prisma.ShopListingWhereInput {
  return {
    ...storefrontShopListingWhere,
    shop: {
      slug: shopSlug,
      active: true,
      ...buyerSalesShopConnectPrismaWhere(),
    },
  };
}
