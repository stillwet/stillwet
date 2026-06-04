import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EU_MEMBER_COUNTRY_CODES,
  intlEconomicNexusDollarLabel,
  intlEconomicNexusSalesThresholdUsdCents,
  intlEconomicNexusTransactionLabel,
  INTL_ECONOMIC_NEXUS_BY_COUNTRY,
} from "@/lib/intl-economic-nexus-thresholds";

describe("intl economic nexus thresholds", () => {
  it("covers all EU member states with a shared non-EU seller rule", () => {
    for (const code of EU_MEMBER_COUNTRY_CODES) {
      assert.equal(INTL_ECONOMIC_NEXUS_BY_COUNTRY[code]?.salesThresholdUsdCents, 0);
      assert.equal(intlEconomicNexusDollarLabel(code), "First B2C sale");
      assert.equal(intlEconomicNexusTransactionLabel(code), "—");
    }
  });

  it("returns country-specific dollar labels and USD thresholds", () => {
    assert.equal(intlEconomicNexusDollarLabel("CA"), "CAD $30,000");
    assert.equal(intlEconomicNexusSalesThresholdUsdCents("CA"), 22_000_00);
    assert.equal(intlEconomicNexusSalesThresholdUsdCents("GB"), 0);
    assert.equal(intlEconomicNexusDollarLabel("ZZ"), "Verify locally");
    assert.equal(intlEconomicNexusSalesThresholdUsdCents("ZZ"), null);
  });
});
