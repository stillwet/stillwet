import { ListingRequestStatus } from "@/generated/prisma/enums";

export type ShopOnboardingSteps = {
  profile: boolean;
  guidelines: boolean;
  emailVerified: boolean;
  listing: boolean;
  stripe: boolean;
};

/** Same predicate as the listing row of {@link computeShopOnboardingSteps} (single-listing checks). */
export function listingOnboardingSatisfied(l: {
  requestStatus: ListingRequestStatus;
  active: boolean;
}): boolean {
  return (
    l.requestStatus === ListingRequestStatus.submitted ||
    l.requestStatus === ListingRequestStatus.images_ok ||
    l.requestStatus === ListingRequestStatus.printify_item_created ||
    l.requestStatus === ListingRequestStatus.approved ||
    l.active
  );
}

export function computeShopOnboardingSteps(input: {
  displayName: string;
  itemGuidelinesAcknowledgedAt: Date | null;
  emailVerifiedAt: Date | null;
  /** Full rows when already loaded (e.g. Connect return path). Omit when using `hasListingProgress`. */
  listings?: { requestStatus: ListingRequestStatus; active: boolean }[];
  /**
   * When listings are not loaded, pass the result of a DB probe with the same semantics as
   * `listings.some(listingOnboardingSatisfied)` (see dashboard `shopListing.findFirst` OR).
   */
  hasListingProgress?: boolean;
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
}): ShopOnboardingSteps {
  const profile = input.displayName.trim().length > 0;
  const guidelines = input.itemGuidelinesAcknowledgedAt != null;
  const emailVerified = input.emailVerifiedAt != null;
  const listing =
    input.listings !== undefined
      ? input.listings.some(listingOnboardingSatisfied)
      : Boolean(input.hasListingProgress);
  const stripe = input.connectChargesEnabled && input.payoutsEnabled;
  return { profile, guidelines, emailVerified, listing, stripe };
}

export function countIncompleteOnboardingSteps(steps: ShopOnboardingSteps): number {
  let n = 0;
  if (!steps.profile) n++;
  if (!steps.guidelines) n++;
  if (!steps.emailVerified) n++;
  if (!steps.listing) n++;
  if (!steps.stripe) n++;
  return n;
}

/** Stripe Connect is allowed only after the non-Stripe checklist is done. */
export function canStartStripeConnect(
  steps: Pick<ShopOnboardingSteps, "profile" | "guidelines" | "emailVerified" | "listing">,
): boolean {
  return steps.profile && steps.guidelines && steps.emailVerified && steps.listing;
}
