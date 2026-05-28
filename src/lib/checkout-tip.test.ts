import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_CHECKOUT_TIP_CENTS,
  PLATFORM_TIP_FEE_CENTS,
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
  it("allows zero", () => {
    assert.equal(validateCheckoutTipCents(0, true), null);
  });

  it("rejects over max", () => {
    assert.match(validateCheckoutTipCents(MAX_CHECKOUT_TIP_CENTS + 1, true)!, /Maximum/);
  });

  it("rejects when not eligible", () => {
    assert.match(validateCheckoutTipCents(200, false)!, /sub catalog/);
  });
});

describe("clampCheckoutTipCents", () => {
  it("clamps to max", () => {
    assert.equal(clampCheckoutTipCents(999), MAX_CHECKOUT_TIP_CENTS);
  });

  it("bumps sub-minimum positive values to min", () => {
    assert.equal(clampCheckoutTipCents(10), 50);
  });
});

describe("constants", () => {
  it("uses twenty-five cent platform tip fee", () => {
    assert.equal(PLATFORM_TIP_FEE_CENTS, 25);
  });
});
