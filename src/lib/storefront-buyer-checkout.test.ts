import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isStorefrontBuyerCheckoutDisabled } from "./storefront-buyer-checkout";

describe("isStorefrontBuyerCheckoutDisabled", () => {
  const prev = process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED;
    else process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED = prev;
  });

  it("is off when unset", () => {
    delete process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED;
    assert.equal(isStorefrontBuyerCheckoutDisabled(), false);
  });

  it("is on for 1 / true / yes", () => {
    process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED = "1";
    assert.equal(isStorefrontBuyerCheckoutDisabled(), true);
    process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED = "true";
    assert.equal(isStorefrontBuyerCheckoutDisabled(), true);
    process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED = "yes";
    assert.equal(isStorefrontBuyerCheckoutDisabled(), true);
  });
});
