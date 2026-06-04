import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyerStripeTaxServiceFeeCents,
  isStripeTaxBuyerFeePassThroughEnabled,
  STRIPE_TAX_BUYER_FEE_RATE,
} from "@/lib/stripe-tax-buyer-fee";

describe("buyerStripeTaxServiceFeeCents", () => {
  it("returns 0.5% of subtotal + shipping + tip when enabled", () => {
    assert.equal(
      buyerStripeTaxServiceFeeCents({
        enabled: true,
        subtotalCents: 2000,
        shippingCents: 500,
        tipCents: 100,
      }),
      Math.round(2600 * STRIPE_TAX_BUYER_FEE_RATE),
    );
  });

  it("returns 0 when disabled", () => {
    assert.equal(
      buyerStripeTaxServiceFeeCents({
        enabled: false,
        subtotalCents: 5000,
        shippingCents: 0,
        tipCents: 0,
      }),
      0,
    );
  });

  it("returns 0 for empty cart base", () => {
    assert.equal(
      buyerStripeTaxServiceFeeCents({
        enabled: true,
        subtotalCents: 0,
        shippingCents: 0,
        tipCents: 0,
      }),
      0,
    );
  });
});

describe("isStripeTaxBuyerFeePassThroughEnabled", () => {
  it("defaults on when automatic tax is enabled", () => {
    const tax = process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    const fee = process.env.STRIPE_TAX_BUYER_FEE;
    delete process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    delete process.env.STRIPE_TAX_BUYER_FEE;
    assert.equal(isStripeTaxBuyerFeePassThroughEnabled(), true);
    if (tax === undefined) delete process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    else process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = tax;
    if (fee === undefined) delete process.env.STRIPE_TAX_BUYER_FEE;
    else process.env.STRIPE_TAX_BUYER_FEE = fee;
  });

  it("can be disabled with STRIPE_TAX_BUYER_FEE=0", () => {
    const tax = process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    const fee = process.env.STRIPE_TAX_BUYER_FEE;
    delete process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    process.env.STRIPE_TAX_BUYER_FEE = "0";
    assert.equal(isStripeTaxBuyerFeePassThroughEnabled(), false);
    if (tax === undefined) delete process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX;
    else process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = tax;
    if (fee === undefined) delete process.env.STRIPE_TAX_BUYER_FEE;
    else process.env.STRIPE_TAX_BUYER_FEE = fee;
  });
});
