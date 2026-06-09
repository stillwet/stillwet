import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAdminAwardGrantSummary } from "@/lib/admin-award-promotions-catalog";

describe("formatAdminAwardGrantSummary", () => {
  it("pluralizes free listing slots without doubling the s", () => {
    assert.equal(formatAdminAwardGrantSummary(50, "Free listing slots"), "50 Free listing slots");
    assert.equal(formatAdminAwardGrantSummary(1, "Free listing slots"), "1 Free listing slot");
  });

  it("pluralizes Google Shopping credits", () => {
    assert.equal(formatAdminAwardGrantSummary(3, "Google Shopping credits"), "3 Google Shopping credits");
    assert.equal(formatAdminAwardGrantSummary(1, "Google Shopping credits"), "1 Google Shopping credit");
  });

  it("omits quantity for flair access", () => {
    assert.equal(formatAdminAwardGrantSummary(1, "Shop flair access"), "Shop flair access");
  });
});
