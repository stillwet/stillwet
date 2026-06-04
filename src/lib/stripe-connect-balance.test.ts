import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  connectBalanceBlocksDeletion,
  getStripeConnectBalanceUsdCents,
} from "@/lib/stripe-connect-balance";

describe("stripe-connect-balance — account deletion gate", () => {
  it("treats missing Connect account as $0 (never set up Stripe)", async () => {
    assert.deepEqual(await getStripeConnectBalanceUsdCents(null), {
      availableCents: 0,
      pendingCents: 0,
    });
    assert.deepEqual(await getStripeConnectBalanceUsdCents(undefined), {
      availableCents: 0,
      pendingCents: 0,
    });
    assert.deepEqual(await getStripeConnectBalanceUsdCents("   "), {
      availableCents: 0,
      pendingCents: 0,
    });
  });

  it("does not block deletion when Connect was never set up", () => {
    assert.equal(connectBalanceBlocksDeletion({ availableCents: 0, pendingCents: 0 }), false);
  });

  it("blocks deletion when balance read failed (Connect exists but Stripe unreachable)", () => {
    assert.equal(connectBalanceBlocksDeletion(null), true);
  });

  it("blocks deletion when funds remain on Connect", () => {
    assert.equal(connectBalanceBlocksDeletion({ availableCents: 100, pendingCents: 0 }), true);
    assert.equal(connectBalanceBlocksDeletion({ availableCents: 0, pendingCents: 50 }), true);
  });
});
