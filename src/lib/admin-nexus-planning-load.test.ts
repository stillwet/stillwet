import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeUsNexusStateRows,
  NEXUS_PLANNING_CACHE_TTL_MS,
  shouldRefreshNexusPlanningCache,
  type AdminNexusPlanningSnapshot,
} from "@/lib/admin-nexus-planning-load";
import { ALL_US_NEXUS_STATE_CODES } from "@/lib/us-economic-nexus-thresholds";

/** Mirrors rollup rules exercised via loadAdminNexusPlanningSnapshot integration in dev. */
function rollupOrders(
  orders: Array<{
    shippingCountry: string | null;
    shippingState: string | null;
    totalCents: number;
    lines: Array<{ unitPriceCents: number; quantity: number }>;
  }>,
): Pick<AdminNexusPlanningSnapshot, "usStates" | "international"> {
  const us = new Map<string, number>();
  const intl = new Map<string, number>();

  for (const o of orders) {
    const merch = o.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
    const country = (o.shippingCountry ?? "").trim().toUpperCase();
    const state = (o.shippingState ?? "").trim().toUpperCase();
    if (country === "US" || (!country && state)) {
      const key = state || "UNKNOWN";
      us.set(key, (us.get(key) ?? 0) + merch);
    } else if (country) {
      intl.set(country, (intl.get(country) ?? 0) + merch);
    }
  }

  return {
    usStates: [...us.entries()].map(([code, merchandiseCents]) => ({
      code,
      orderCount: 1,
      merchandiseCents,
    })),
    international: [...intl.entries()].map(([code, merchandiseCents]) => ({
      code,
      orderCount: 1,
      merchandiseCents,
    })),
  };
}

describe("mergeUsNexusStateRows", () => {
  it("includes every US state with zero sales when absent from orders", () => {
    const rows = mergeUsNexusStateRows(
      new Map([
        ["CA", { orderCount: 2, merchandiseCents: 5000_00 }],
        ["NY", { orderCount: 1, merchandiseCents: 1000_00 }],
      ]),
    );
    assert.equal(rows.length, ALL_US_NEXUS_STATE_CODES.length);
    assert.equal(rows.find((r) => r.code === "TX")?.orderCount, 0);
    assert.equal(rows.find((r) => r.code === "TX")?.merchandiseCents, 0);
    assert.equal(rows.find((r) => r.code === "CA")?.merchandiseCents, 5000_00);
    assert.equal(rows[0]?.code, "CA");
  });

  it("appends non-standard ship-to codes such as UNKNOWN", () => {
    const rows = mergeUsNexusStateRows(
      new Map([["UNKNOWN", { orderCount: 1, merchandiseCents: 2500 }]]),
    );
    assert.equal(rows.length, ALL_US_NEXUS_STATE_CODES.length + 1);
    assert.equal(rows.find((r) => r.code === "UNKNOWN")?.orderCount, 1);
  });
});

describe("nexus destination rollup", () => {
  it("groups US orders by state and others by country", () => {
    const { usStates, international } = rollupOrders([
      {
        shippingCountry: "US",
        shippingState: "CA",
        totalCents: 2500,
        lines: [{ unitPriceCents: 2000, quantity: 1 }],
      },
      {
        shippingCountry: "US",
        shippingState: "NY",
        totalCents: 1500,
        lines: [{ unitPriceCents: 1000, quantity: 1 }],
      },
      {
        shippingCountry: "CA",
        shippingState: "ON",
        totalCents: 3000,
        lines: [{ unitPriceCents: 2800, quantity: 1 }],
      },
    ]);
    assert.equal(usStates.find((r) => r.code === "CA")?.merchandiseCents, 2000);
    assert.equal(usStates.find((r) => r.code === "NY")?.merchandiseCents, 1000);
    assert.equal(international.find((r) => r.code === "CA")?.merchandiseCents, 2800);
  });
});

describe("shouldRefreshNexusPlanningCache", () => {
  it("does not refresh within the weekly TTL", () => {
    const now = new Date("2026-06-08T12:00:00Z");
    const computedAt = new Date(now.getTime() - NEXUS_PLANNING_CACHE_TTL_MS + 60_000);
    assert.equal(shouldRefreshNexusPlanningCache(computedAt, now, true), false);
  });

  it("refreshes after TTL only when there was a recent sale", () => {
    const now = new Date("2026-06-08T12:00:00Z");
    const computedAt = new Date(now.getTime() - NEXUS_PLANNING_CACHE_TTL_MS - 1);
    assert.equal(shouldRefreshNexusPlanningCache(computedAt, now, true), true);
    assert.equal(shouldRefreshNexusPlanningCache(computedAt, now, false), false);
  });
});
