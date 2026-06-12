import type { Prisma } from "@/generated/prisma/client";
import { ListingRequestStatus } from "@/generated/prisma/enums";

/**
 * Shop listings that still occupy a Printify catalog product id for admin Step 2 pick lists.
 * Rows removed from the shop or listing-request queue may keep `listingPrintifyProductId`
 * historically but must not hide that id from other requests.
 */
export const shopListingPrintifyMappingReservedWhere = {
  listingPrintifyProductId: { not: null },
  requestStatus: { not: ListingRequestStatus.rejected },
  removedFromListingRequestsAt: null,
  shop: { users: { some: {} } },
  OR: [
    {
      active: true,
      creatorRemovedFromShopAt: null,
      adminRemovedFromShopAt: null,
      hiddenStorefrontForAccountDeletionAt: null,
    },
    {
      requestStatus: {
        in: [ListingRequestStatus.printify_item_created, ListingRequestStatus.approved],
      },
      creatorRemovedFromShopAt: null,
      adminRemovedFromShopAt: null,
    },
  ],
} satisfies Prisma.ShopListingWhereInput;

/** Hide Printify ids already mapped on active / in-flight listings; keep this row’s current pick visible. */
export function printifyCatalogPickListForListingRow<T extends { id: string; title: string }>(
  fullCatalog: readonly T[],
  mappedToAnyListing: readonly string[],
  currentPrintifyProductId: string,
): T[] {
  const mapped = new Set(mappedToAnyListing.map((id) => id.trim()).filter(Boolean));
  const cur = currentPrintifyProductId.trim();
  const base = fullCatalog.filter((p) => {
    const id = p.id.trim();
    return !mapped.has(id) || id === cur;
  });
  if (cur && !base.some((p) => p.id.trim() === cur)) {
    const hit = fullCatalog.find((p) => p.id.trim() === cur);
    if (hit) return [hit, ...base.filter((p) => p.id.trim() !== cur)];
    return [
      { id: cur, title: "Linked Printify product (not in live catalog)" } as T,
      ...base,
    ];
  }
  return [...base];
}
