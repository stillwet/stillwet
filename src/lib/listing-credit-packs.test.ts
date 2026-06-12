import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTING_CREDIT_PACKS,
  listingCreditPackById,
  parseListingCreditPackId,
} from "@/lib/listing-credit-packs";
import {
  listingRequestBlockedForNoCredits,
  nextListingRequestRequiresCredit,
  shopListingCreditsAvailable,
  type FreeListingRequestSlotsSummary,
} from "@/lib/marketplace-constants";

describe("listing credit packs", () => {
  it("parses valid pack ids", () => {
    assert.equal(parseListingCreditPackId("pack_5"), "pack_5");
    assert.equal(parseListingCreditPackId(" pack_15 "), "pack_15");
    assert.equal(parseListingCreditPackId("pack_99"), null);
    assert.equal(listingCreditPackById("pack_25")?.credits, 25);
  });

  it("exposes three packs with expected prices", () => {
    assert.equal(LISTING_CREDIT_PACKS.length, 3);
    assert.deepEqual(
      LISTING_CREDIT_PACKS.map((p) => ({ credits: p.credits, priceCents: p.priceCents })),
      [
        { credits: 5, priceCents: 500 },
        { credits: 15, priceCents: 1000 },
        { credits: 25, priceCents: 1500 },
      ],
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

  it("blocks request listing when paid slot needed and no credits", () => {
    const slots: FreeListingRequestSlotsSummary = {
      cap: 3,
      remaining: 0,
      listingCreditsAvailable: 0,
      founderUnlimited: false,
    };
    assert.equal(listingRequestBlockedForNoCredits(true, slots), true);
    assert.equal(listingRequestBlockedForNoCredits(false, slots), false);
    assert.equal(
      listingRequestBlockedForNoCredits(true, {
        ...slots,
        listingCreditsAvailable: 2,
      }),
      false,
    );
    assert.equal(
      listingRequestBlockedForNoCredits(true, {
        cap: 3,
        remaining: Number.POSITIVE_INFINITY,
        listingCreditsAvailable: Number.POSITIVE_INFINITY,
        founderUnlimited: true,
      }),
      false,
    );
  });
});
