import type { Prisma } from "@/generated/prisma/client";

/**
 * Shop listings that still occupy a Printify catalog product id for admin Step 2 pick lists.
 * Rows removed from the shop or listing-request queue may keep `listingPrintifyProductId`
 * historically but must not hide that id from other requests.
 */
export const shopListingPrintifyMappingReservedWhere = {
  listingPrintifyProductId: { not: null },
  creatorRemovedFromShopAt: null,
  adminRemovedFromShopAt: null,
  removedFromListingRequestsAt: null,
} satisfies Prisma.ShopListingWhereInput;
