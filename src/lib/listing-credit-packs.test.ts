import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTING_CREDIT_PACKS,
  listingCreditPackById,
  parseListingCreditPackId,
} from "@/lib/listing-credit-packs";
import {
  nextListingRequestRequiresCredit,
  shopListingCreditsAvailable,
} from "@/lib/marketplace-constants";

describe("listing credit packs", () => {
  it("parses valid pack ids", () => {
    assert.equal(parseListingCreditPackId("pack_10"), "pack_10");
    assert.equal(parseListingCreditPackId(" pack_25 "), "pack_25");
    assert.equal(parseListingCreditPackId("pack_99"), null);
    assert.equal(listingCreditPackById("pack_50")?.credits, 50);
  });

  it("exposes three packs with expected prices", () => {
    assert.equal(LISTING_CREDIT_PACKS.length, 3);
    assert.deepEqual(
      LISTING_CREDIT_PACKS.map((p) => p.priceCents),
      [500, 1000, 1500],
    );
  });
});

describe("listing credit submit gate", () => {
  it("requires credit when beyond free pool with no bonus", () => {
    assert.equal(nextListingRequestRequiresCredit("my-shop", 0, 3), true);
    assert.equal(shopListingCreditsAvailable(0, 3), 0);
  });

  it("does not require credit within free + bonus cap", () => {
    assert.equal(nextListingRequestRequiresCredit("my-shop", 5, 2), false);
    assert.equal(shopListingCreditsAvailable(5, 5), 3);
  });
});
