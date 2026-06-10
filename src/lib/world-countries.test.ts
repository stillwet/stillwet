import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWorldCountryCodeExcludingUs,
  resetWorldCountriesCacheForTests,
  worldCountriesExcludingUs,
} from "@/lib/world-countries";

describe("worldCountriesExcludingUs", () => {
  it("excludes United States", () => {
    resetWorldCountriesCacheForTests();
    const list = worldCountriesExcludingUs();
    assert.equal(list.some((c) => c.code === "US"), false);
    assert.equal(isWorldCountryCodeExcludingUs("US"), false);
  });

  it("sorts alphabetically by label", () => {
    resetWorldCountriesCacheForTests();
    const list = worldCountriesExcludingUs();
    const labels = list.map((c) => c.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    assert.deepEqual(labels, sorted);
  });

  it("validates known country codes", () => {
    resetWorldCountriesCacheForTests();
    assert.equal(isWorldCountryCodeExcludingUs("CA"), true);
    assert.equal(isWorldCountryCodeExcludingUs("GB"), true);
    assert.equal(isWorldCountryCodeExcludingUs("XX"), false);
  });
});
