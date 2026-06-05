import { ListingRequestStatus } from "@/generated/prisma/enums";

/** Max listing requests awaiting admin review per shop at once. */
export const SHOP_MAX_IN_REVIEW_LISTING_REQUESTS = 3 as const;

/** Statuses shown as “In review” in the creator dashboard. */
export const LISTING_REQUEST_IN_REVIEW_STATUSES = [
  ListingRequestStatus.submitted,
  ListingRequestStatus.images_ok,
  ListingRequestStatus.printify_item_created,
] as const;

export function isListingRequestStatusInReview(status: ListingRequestStatus): boolean {
  return (LISTING_REQUEST_IN_REVIEW_STATUSES as readonly ListingRequestStatus[]).includes(status);
}

export function shopCanSubmitAnotherListingRequest(inReviewCount: number): boolean {
  return inReviewCount < SHOP_MAX_IN_REVIEW_LISTING_REQUESTS;
}

export function shopInReviewListingRequestLimitReached(inReviewCount: number): boolean {
  return !shopCanSubmitAnotherListingRequest(inReviewCount);
}

export function shopInReviewListingRequestLimitError(): string {
  return `You already have ${SHOP_MAX_IN_REVIEW_LISTING_REQUESTS} listings in review. Wait for admin approval on one of them before submitting another.`;
}

export function countListingRowsInReview(
  listings: ReadonlyArray<{ requestStatus: ListingRequestStatus }>,
): number {
  return listings.filter((l) => isListingRequestStatusInReview(l.requestStatus)).length;
}
