import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyerCardProcessingFeeCents,
  buyerCheckoutTotalCents,
} from "@/lib/stripe-card-processing-fee";
import { SHOP_SETUP_FEE_CENTS } from "@/lib/creator-gift-codes";

describe("stripe card processing fee", () => {
  it("returns zero for non-positive subtotals", () => {
    assert.equal(buyerCardProcessingFeeCents(0), 0);
    assert.equal(buyerCheckoutTotalCents(0), 0);
  });

  it("grosses up the fifteen-dollar shop setup fee", () => {
    const fee = buyerCardProcessingFeeCents(SHOP_SETUP_FEE_CENTS);
    assert.equal(buyerCheckoutTotalCents(SHOP_SETUP_FEE_CENTS), SHOP_SETUP_FEE_CENTS + fee);
    assert.equal(fee, 76);
    assert.equal(SHOP_SETUP_FEE_CENTS + fee, 1576);
  });
});
