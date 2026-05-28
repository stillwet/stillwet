import { ListingRequestStatus } from "@/generated/prisma/enums";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { listingFeeCentsForOrdinal } from "@/lib/marketplace-constants";
import type { PrismaClient } from "@/generated/prisma/client";

export type UnpaidPublicationFeeListingRow = {
  listingId: string;
  label: string;
};

const ELIGIBLE_STATUSES: ListingRequestStatus[] = [
  ListingRequestStatus.draft,
  ListingRequestStatus.submitted,
  ListingRequestStatus.images_ok,
  ListingRequestStatus.printify_item_created,
  ListingRequestStatus.approved,
];

/** Draft / in-progress listings that still owe a paid publication fee (after free-slot waivers). */
export async function loadUnpaidPublicationFeeListings(
  db: Pick<PrismaClient, "shop" | "shopListing">,
  shopId: string,
): Promise<UnpaidPublicationFeeListingRow[]> {
  await syncFreeListingFeeWaivers(shopId);

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { slug: true, listingFeeBonusFreeSlots: true },
  });
  if (!shop) return [];

  const bonus = Math.max(0, shop.listingFeeBonusFreeSlots ?? 0);
  const ordinalRows = await db.shopListing.findMany({
    where: { shopId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const ordinalById = new Map(ordinalRows.map((r, i) => [r.id, i + 1]));

  const candidates = await db.shopListing.findMany({
    where: {
      shopId,
      listingFeePaidAt: null,
      creatorRemovedFromShopAt: null,
      adminRemovedFromShopAt: null,
      requestStatus: { in: ELIGIBLE_STATUSES },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      requestItemName: true,
      product: { select: { name: true, slug: true } },
    },
  });

  const rows: UnpaidPublicationFeeListingRow[] = [];
  for (const listing of candidates) {
    const ordinal = ordinalById.get(listing.id);
    if (!ordinal) continue;
    const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, bonus);
    if (feeCents <= 0) continue;
    const label =
      listing.requestItemName?.trim() ||
      listing.product.name?.trim() ||
      listing.product.slug;
    rows.push({
      listingId: listing.id,
      label,
    });
  }
  return rows;
}
