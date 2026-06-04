import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_US_NEXUS_STATE_CODES, US_STATES_WITHOUT_SALES_TAX } from "@/lib/us-economic-nexus-thresholds";
import {
  isSalesTaxRegistrationRenewalWithinDays,
  isSubduedRegistrationRenewalLabel,
  US_SALES_TAX_REGISTRATION_COST_BY_STATE,
  usSalesTaxRegistrationCostLabel,
  usSalesTaxRegistrationRenewalLabel,
} from "@/lib/us-sales-tax-registration-costs";

describe("us sales tax registration costs", () => {
  it("covers every state with sales tax", () => {
    const noTax = new Set(US_STATES_WITHOUT_SALES_TAX);
    const taxingStates = ALL_US_NEXUS_STATE_CODES.filter((code) => !noTax.has(code));
    assert.equal(Object.keys(US_SALES_TAX_REGISTRATION_COST_BY_STATE).length, taxingStates.length);
    for (const code of taxingStates) {
      assert.ok(US_SALES_TAX_REGISTRATION_COST_BY_STATE[code]?.label);
      assert.ok(US_SALES_TAX_REGISTRATION_COST_BY_STATE[code]?.renewalLabel);
    }
  });

  it("returns known fee and renewal labels", () => {
    assert.equal(usSalesTaxRegistrationCostLabel("SC"), "$50");
    assert.equal(usSalesTaxRegistrationRenewalLabel("OK"), "Every 3 yr");
    assert.equal(usSalesTaxRegistrationRenewalLabel("TX"), "No expiry");
    assert.ok(isSubduedRegistrationRenewalLabel("No expiry"));
    assert.equal(usSalesTaxRegistrationCostLabel("AK"), "—");
  });

  it("flags renewal within 60 days from registered date", () => {
    const asOf = new Date(Date.UTC(2026, 5, 2)); // 2026-06-02
    assert.ok(
      isSalesTaxRegistrationRenewalWithinDays("AL", "2025-06-15", {
        asOf,
        withinDays: 60,
      }),
    );
    assert.ok(
      !isSalesTaxRegistrationRenewalWithinDays("AL", "2025-08-02", {
        asOf,
        withinDays: 60,
      }),
    );
    assert.ok(!isSalesTaxRegistrationRenewalWithinDays("TX", "2025-06-15", { asOf }));
    assert.ok(!isSalesTaxRegistrationRenewalWithinDays("AL", null, { asOf }));
  });
});
