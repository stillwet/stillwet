import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStripeCheckoutAutomaticTaxEnabled,
  stripeCheckoutAutomaticTax,
} from "@/lib/stripe-checkout-tax";

describe("isStripeCheckoutAutomaticTaxEnabled", () => {
  it("defaults to enabled", () => {
    const prev = process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    delete process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    assert.equal(isStripeCheckoutAutomaticTaxEnabled(), true);
    if (prev === undefined) delete process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    else process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = prev;
  });

  it("can be disabled with STRIPE_CHECKOUT_AUTOMATIC_TAX=0", () => {
    const prev = process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = "0";
    assert.equal(isStripeCheckoutAutomaticTaxEnabled(), false);
    if (prev === undefined) delete process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    else process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = prev;
  });
});

describe("stripeCheckoutAutomaticTax", () => {
  it("assigns tax liability to connected account for Connect checkout", () => {
    assert.deepEqual(stripeCheckoutAutomaticTax("acct_123"), {
      enabled: true,
      liability: { type: "account", account: "acct_123" },
    });
  });

  it("uses platform liability when no connected account", () => {
    assert.deepEqual(stripeCheckoutAutomaticTax(null), { enabled: true });
  });
});
