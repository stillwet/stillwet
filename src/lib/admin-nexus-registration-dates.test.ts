import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatNexusRegistrationDateLabel,
  isValidNexusRegistrationIsoDate,
  parseAdminNexusRegistrationDatesByCode,
} from "@/lib/admin-nexus-registration-dates";

describe("admin nexus registration dates", () => {
  it("validates ISO calendar dates", () => {
    assert.ok(isValidNexusRegistrationIsoDate("2024-06-15"));
    assert.ok(!isValidNexusRegistrationIsoDate("2024-02-30"));
    assert.ok(!isValidNexusRegistrationIsoDate("06/15/2024"));
  });

  it("parses and normalizes stored JSON", () => {
    assert.deepEqual(
      parseAdminNexusRegistrationDatesByCode({
        tx: "2024-01-02",
        OK: "2023-12-31",
        bad: "not-a-date",
      }),
      { TX: "2024-01-02", OK: "2023-12-31" },
    );
  });

  it("formats labels in UTC", () => {
    assert.equal(formatNexusRegistrationDateLabel("2024-06-15"), "Jun 15, 2024");
  });
});
