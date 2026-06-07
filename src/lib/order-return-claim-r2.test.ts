import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOrderReturnClaimImageR2KeyForClaim,
  orderReturnClaimImageObjectKey,
} from "@/lib/order-return-claim-r2";

describe("orderReturnClaimImageObjectKey", () => {
  it("builds the returns/claims path", () => {
    const claimId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    assert.equal(orderReturnClaimImageObjectKey(claimId, 0), `returns/claims/${claimId}/0.webp`);
    assert.equal(orderReturnClaimImageObjectKey(claimId, 2), `returns/claims/${claimId}/2.webp`);
  });
});

describe("isOrderReturnClaimImageR2KeyForClaim", () => {
  const claimId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("accepts keys for the claim", () => {
    assert.equal(
      isOrderReturnClaimImageR2KeyForClaim(orderReturnClaimImageObjectKey(claimId, 1), claimId),
      true,
    );
  });

  it("rejects other claims and unsafe paths", () => {
    const other = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee";
    assert.equal(
      isOrderReturnClaimImageR2KeyForClaim(orderReturnClaimImageObjectKey(other, 0), claimId),
      false,
    );
    assert.equal(
      isOrderReturnClaimImageR2KeyForClaim(`returns/claims/${claimId}/../secret.webp`, claimId),
      false,
    );
    assert.equal(isOrderReturnClaimImageR2KeyForClaim("shops/x/avatar.webp", claimId), false);
  });
});
