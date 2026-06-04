import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminNexusPlanningSnapshot } from "@/lib/admin-nexus-planning-load";
import { ALL_US_NEXUS_STATE_CODES } from "@/lib/us-economic-nexus-thresholds";
import { applyNexusPlanningDemoSales } from "@/lib/admin-nexus-planning-demo";

function emptySnapshot(): AdminNexusPlanningSnapshot {
  return {
    usStates: ALL_US_NEXUS_STATE_CODES.map((code) => ({
      code,
      orderCount: 0,
      merchandiseCents: 0,
    })),
    international: [],
    missingDestination: null,
    grandOrderCount: 0,
    grandMerchandiseCents: 0,
  };
}

describe("applyNexusPlanningDemoSales", () => {
  it("adds OK, MO, and ME demo merchandise rollups", () => {
    const out = applyNexusPlanningDemoSales(emptySnapshot());
    assert.equal(out.usStates.find((r) => r.code === "OK")?.orderCount, 1);
    assert.equal(out.usStates.find((r) => r.code === "OK")?.merchandiseCents, 45_00);
    assert.equal(out.usStates.find((r) => r.code === "MO")?.orderCount, 5);
    assert.equal(out.usStates.find((r) => r.code === "MO")?.merchandiseCents, 150_00);
    assert.equal(out.usStates.find((r) => r.code === "ME")?.orderCount, 3);
    assert.equal(out.usStates.find((r) => r.code === "ME")?.merchandiseCents, 90_00);
    assert.equal(out.grandOrderCount, 9);
    assert.equal(out.grandMerchandiseCents, 45_00 + 150_00 + 90_00);
  });
});
