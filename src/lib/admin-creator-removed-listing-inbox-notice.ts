import { recordAdminInboxSystemNotice } from "@/lib/admin-inbox-system-notice";

export type NotifyAdminCreatorRemovedListingParams = {
  shop: { slug: string; displayName: string | null };
  listing: {
    id: string;
    requestItemName: string | null;
    listingPrintifyProductId: string | null;
    listingPrintifyVariantId: string | null;
    catalogProductName: string;
  };
  removedAt?: Date;
};

function listingTitleForNotice(listing: NotifyAdminCreatorRemovedListingParams["listing"]): string {
  return listing.requestItemName?.trim() || listing.catalogProductName.trim() || "Listing";
}

/**
 * Admin Inbox notice when a creator removes an approved listing from their storefront.
 */
export async function notifyAdminCreatorRemovedListingFromShop(
  params: NotifyAdminCreatorRemovedListingParams,
): Promise<void> {
  const removedAt = params.removedAt ?? new Date();
  const { shop, listing } = params;
  const title = listingTitleForNotice(listing);
  const shopLabel = shop.displayName?.trim() || shop.slug;
  const printifyProductId = listing.listingPrintifyProductId?.trim() || null;
  const printifyVariantId = listing.listingPrintifyVariantId?.trim() || null;

  const lines = [
    "A shop owner removed a listing from their public storefront.",
    "",
    `Shop: ${shopLabel} (/${shop.slug})`,
    `Listing: “${title}”`,
    `Catalog product: ${listing.catalogProductName}`,
    `Listing id: ${listing.id}`,
    "",
    "Printify (for reference):",
    printifyProductId
      ? `  Product id: ${printifyProductId}`
      : "  Product id: (none recorded on this listing)",
    printifyVariantId
      ? `  Variant id: ${printifyVariantId}`
      : "  Variant id: (none recorded)",
    "",
    "Storefront listing images on R2 were deleted. The listing row and order history are retained.",
  ];

  const subject = "Removed Listing - Delete Printify Item";

  await recordAdminInboxSystemNotice({
    resendEmailIdSuffix: `creator-removed-listing:${listing.id}:${removedAt.getTime()}`,
    subject,
    textBody: lines.join("\n"),
    receivedAt: removedAt,
  });
}
