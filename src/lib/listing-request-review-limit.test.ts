import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import {
  countListingRowsInReview,
  isListingRequestStatusInReview,
  shopCanSubmitAnotherListingRequest,
  shopInReviewListingRequestLimitError,
  shopInReviewListingRequestLimitReached,
  SHOP_MAX_IN_REVIEW_LISTING_REQUESTS,
} from "@/lib/listing-request-review-limit";

describe("isListingRequestStatusInReview", () => {
  it("includes submitted pipeline statuses", () => {
    assert.equal(isListingRequestStatusInReview(ListingRequestStatus.submitted), true);
    assert.equal(isListingRequestStatusInReview(ListingRequestStatus.images_ok), true);
    assert.equal(isListingRequestStatusInReview(ListingRequestStatus.printify_item_created), true);
  });

  it("excludes draft, approved, and rejected", () => {
    assert.equal(isListingRequestStatusInReview(ListingRequestStatus.draft), false);
    assert.equal(isListingRequestStatusInReview(ListingRequestStatus.approved), false);
    assert.equal(isListingRequestStatusInReview(ListingRequestStatus.rejected), false);
  });
});

describe("shopCanSubmitAnotherListingRequest", () => {
  it("allows submit when below cap", () => {
    assert.equal(shopCanSubmitAnotherListingRequest(0), true);
    assert.equal(shopCanSubmitAnotherListingRequest(SHOP_MAX_IN_REVIEW_LISTING_REQUESTS - 1), true);
  });

  it("blocks at cap", () => {
    assert.equal(shopCanSubmitAnotherListingRequest(SHOP_MAX_IN_REVIEW_LISTING_REQUESTS), false);
    assert.equal(
      shopInReviewListingRequestLimitReached(SHOP_MAX_IN_REVIEW_LISTING_REQUESTS),
      true,
    );
  });
});

describe("countListingRowsInReview", () => {
  it("counts only in-review rows", () => {
    const n = countListingRowsInReview([
      { requestStatus: ListingRequestStatus.draft },
      { requestStatus: ListingRequestStatus.submitted },
      { requestStatus: ListingRequestStatus.images_ok },
      { requestStatus: ListingRequestStatus.approved },
    ]);
    assert.equal(n, 2);
  });
});

describe("shopInReviewListingRequestLimitError", () => {
  it("mentions the cap", () => {
    assert.match(shopInReviewListingRequestLimitError(), /3 listings in review/);
  });
});
