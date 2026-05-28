import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  stripeConnectActivationHint,
  stripeConnectFlagsFromAccount,
} from "@/lib/stripe-connect-account-status";

describe("stripe-connect-account-status", () => {
  it("maps Stripe account flags to shop columns", () => {
    assert.deepEqual(
      stripeConnectFlagsFromAccount({ charges_enabled: true, payouts_enabled: false }),
      { connectChargesEnabled: true, payoutsEnabled: false },
    );
  });

  it("returns null hint when fully enabled", () => {
    assert.equal(
      stripeConnectActivationHint({
        charges_enabled: true,
        payouts_enabled: true,
      } as Stripe.Account),
      null,
    );
  });

  it("lists currently_due requirements", () => {
    const hint = stripeConnectActivationHint({
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: ["external_account", "individual.id_number"] },
    } as Stripe.Account);
    assert.ok(hint?.includes("bank account"));
    assert.ok(hint?.includes("identity"));
  });
});
