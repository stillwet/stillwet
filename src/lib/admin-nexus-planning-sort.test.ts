import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminNexusDestinationRow } from "@/lib/admin-nexus-planning-load";
import { sortIntlNexusDestinationRows, sortUsNexusDestinationRows } from "@/lib/admin-nexus-planning-sort";

describe("sortUsNexusDestinationRows", () => {
  it("sorts states with sales by highest sale amount before nexus threshold order", () => {
    const rows: AdminNexusDestinationRow[] = [
      { code: "NY", orderCount: 1, merchandiseCents: 1000_00 },
      { code: "CA", orderCount: 2, merchandiseCents: 5000_00 },
      { code: "AZ", orderCount: 0, merchandiseCents: 0 },
      { code: "TX", orderCount: 0, merchandiseCents: 0 },
    ];
    const sorted = sortUsNexusDestinationRows(rows).map((r) => r.code);
    assert.deepEqual(sorted.slice(0, 4), ["CA", "NY", "AZ", "TX"]);
  });

  it("sorts zero-sale states by lowest dollar nexus, then lowest sale nexus", () => {
    const rows: AdminNexusDestinationRow[] = [
      { code: "NY", orderCount: 50, merchandiseCents: 0 },
      { code: "TX", orderCount: 0, merchandiseCents: 0 },
      { code: "AZ", orderCount: 0, merchandiseCents: 0 },
      { code: "AR", orderCount: 0, merchandiseCents: 0 },
      { code: "CA", orderCount: 0, merchandiseCents: 0 },
    ];
    const sorted = sortUsNexusDestinationRows(rows).map((r) => r.code);
    assert.deepEqual(sorted, ["AZ", "AR", "CA", "TX", "NY"]);
  });
});

describe("sortIntlNexusDestinationRows", () => {
  it("sorts countries with sales by highest sale amount", () => {
    const rows: AdminNexusDestinationRow[] = [
      { code: "GB", orderCount: 1, merchandiseCents: 1000 },
      { code: "CA", orderCount: 1, merchandiseCents: 2000 },
      { code: "JP", orderCount: 1, merchandiseCents: 3000 },
    ];
    const sorted = sortIntlNexusDestinationRows(rows).map((r) => r.code);
    assert.deepEqual(sorted, ["JP", "CA", "GB"]);
  });

  it("sorts zero-sale countries by lowest dollar nexus threshold", () => {
    const rows: AdminNexusDestinationRow[] = [
      { code: "JP", orderCount: 0, merchandiseCents: 0 },
      { code: "CA", orderCount: 0, merchandiseCents: 0 },
      { code: "GB", orderCount: 0, merchandiseCents: 0 },
    ];
    const sorted = sortIntlNexusDestinationRows(rows).map((r) => r.code);
    assert.deepEqual(sorted, ["GB", "CA", "JP"]);
  });
});
