import type { Prisma } from "@/generated/prisma/client";

/**
 * `ShopListing` → `product` include for grids, carousels, cart, and checkout.
 * Loads admin catalog link names for storefront titles (never rely on Printify `Product.name` for display).
 */
export const STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE = {
  primaryTag: true,
  tags: { include: { tag: true } },
  adminCatalogItemPlatformLinks: {
    select: { name: true, itemExampleListingUrl: true },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.ProductInclude;
