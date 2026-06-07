import { ListingRequestStatus } from "@/generated/prisma/enums";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { shopStripeConnectReadyForBuyerSales } from "@/lib/shop-stripe-connect-gate";

export type GoogleMerchantListingRow = {
  shopActive: boolean;
  shopSlug: string;
  shopStripeConnectAccountId: string | null;
  shopConnectChargesEnabled: boolean;
  listing: {
    active: boolean;
    requestStatus: ListingRequestStatus;
    creatorRemovedFromShopAt: Date | null;
    adminRemovedFromShopAt: Date | null;
    hiddenStorefrontForAccountDeletionAt: Date | null;
  };
};

/** Whether an enrolled listing should be live on Google Merchant (storefront-visible + shop active). */
export function isListingEligibleForGoogleMerchantSync(row: GoogleMerchantListingRow): boolean {
  if (!row.shopActive) return false;
  if (
    !shopStripeConnectReadyForBuyerSales({
      slug: row.shopSlug,
      stripeConnectAccountId: row.shopStripeConnectAccountId,
      connectChargesEnabled: row.shopConnectChargesEnabled,
    })
  ) {
    return false;
  }
  const l = row.listing;
  if (l.requestStatus !== ListingRequestStatus.approved) return false;
  if (!l.active) return false;
  if (l.creatorRemovedFromShopAt) return false;
  if (l.adminRemovedFromShopAt) return false;
  if (l.hiddenStorefrontForAccountDeletionAt) return false;
  return true;
}

/** Prisma where fragment matching {@link storefrontShopListingWhere} + approved. */
export const googleMerchantEligibleListingWhere = {
  ...storefrontShopListingWhere,
  requestStatus: ListingRequestStatus.approved,
} as const;
