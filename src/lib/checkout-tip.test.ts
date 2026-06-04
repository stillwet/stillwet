import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHECKOUT_TIP_STRIPE_TAX_CODE,
  MAX_CHECKOUT_TIP_CENTS,
  PLATFORM_TIP_FEE_CENTS,
  checkoutApplicationFeeCents,
  checkoutTipApplicationFeeCents,
  clampCheckoutTipCents,
  splitCheckoutTipCents,
  validateCheckoutTipCents,
} from "@/lib/checkout-tip";

describe("splitCheckoutTipCents", () => {
  it("splits platform fee and shop share", () => {
    assert.deepEqual(splitCheckoutTipCents(500), {
      platformTipFeeCents: 25,
      shopTipCents: 475,
    });
  });

  it("caps platform fee when tip is smaller than fee", () => {
    assert.deepEqual(splitCheckoutTipCents(50), {
      platformTipFeeCents: 25,
      shopTipCents: 25,
    });
  });

  it("returns zeros for no tip", () => {
    assert.deepEqual(splitCheckoutTipCents(0), {
      platformTipFeeCents: 0,
      shopTipCents: 0,
    });
  });
});

describe("validateCheckoutTipCents", () => {
  it("allows zero without further checks", () => {
    assert.equal(validateCheckoutTipCents(0), null);
  });

  it("rejects over max", () => {
    assert.match(validateCheckoutTipCents(MAX_CHECKOUT_TIP_CENTS + 1)!, /Maximum/);
  });

  it("rejects below minimum when tip is positive", () => {
    assert.match(validateCheckoutTipCents(25)!, /Minimum/);
  });
});

describe("clampCheckoutTipCents", () => {
  it("clamps to max", () => {
    assert.equal(clampCheckoutTipCents(1500), MAX_CHECKOUT_TIP_CENTS);
  });

  it("bumps sub-minimum positive values to min", () => {
    assert.equal(clampCheckoutTipCents(10), 50);
  });
});

describe("checkoutApplicationFeeCents", () => {
  it("adds 25 cent platform tip fee to merchandise application fee", () => {
    assert.equal(
      checkoutApplicationFeeCents({ merchandiseApplicationFeeCents: 400, tipCents: 200 }),
      425,
    );
  });

  it("adds no tip fee when tip is zero", () => {
    assert.equal(
      checkoutApplicationFeeCents({ merchandiseApplicationFeeCents: 400, tipCents: 0 }),
      400,
    );
  });
});

describe("checkoutTipApplicationFeeCents", () => {
  it("returns platform tip fee constant for paid tips", () => {
    assert.equal(checkoutTipApplicationFeeCents(50), PLATFORM_TIP_FEE_CENTS);
    assert.equal(checkoutTipApplicationFeeCents(1000), PLATFORM_TIP_FEE_CENTS);
  });

  it("returns zero when there is no tip", () => {
    assert.equal(checkoutTipApplicationFeeCents(0), 0);
  });
});

describe("constants", () => {
  it("uses twenty-five cent platform tip fee", () => {
    assert.equal(PLATFORM_TIP_FEE_CENTS, 25);
  });

  it("uses Stripe gratuity tax code for checkout tips", () => {
    assert.equal(CHECKOUT_TIP_STRIPE_TAX_CODE, "txcd_92010001");
  });
});
