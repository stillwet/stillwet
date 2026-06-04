import type { AdminNexusDestinationRow, AdminNexusPlanningSnapshot } from "@/lib/admin-nexus-planning-load";
import { mergeUsNexusStateRows } from "@/lib/admin-nexus-planning-load";

/** Fake US ship-to rollups for nexus planning demos (merchandise per order × order count). */
export const NEXUS_PLANNING_DEMO_US_SALES = [
  { state: "OK", orderCount: 1, unitPriceCents: 45_00 },
  { state: "MO", orderCount: 5, unitPriceCents: 30_00 },
  { state: "ME", orderCount: 3, unitPriceCents: 30_00 },
] as const;

/**
 * Overlay demo sales on the nexus rollup. On by default in development; set
 * `NEXUS_PLANNING_DEMO_SALES=0` to disable locally or `=1` to force in other envs.
 */
export function nexusPlanningDemoSalesEnabled(): boolean {
  if (process.env.NEXUS_PLANNING_DEMO_SALES === "0") return false;
  if (process.env.NEXUS_PLANNING_DEMO_SALES === "1") return true;
  return process.env.NODE_ENV === "development";
}

export function applyNexusPlanningDemoSales(
  snapshot: AdminNexusPlanningSnapshot,
): AdminNexusPlanningSnapshot {
  const usByState = new Map<
    string,
    { orderCount: number; merchandiseCents: number }
  >();
  for (const row of snapshot.usStates) {
    usByState.set(row.code, {
      orderCount: row.orderCount,
      merchandiseCents: row.merchandiseCents,
    });
  }

  let addedOrders = 0;
  let addedMerchandiseCents = 0;
  for (const demo of NEXUS_PLANNING_DEMO_US_SALES) {
    const lineMerch = demo.orderCount * demo.unitPriceCents;
    addedOrders += demo.orderCount;
    addedMerchandiseCents += lineMerch;
    const bucket = usByState.get(demo.state) ?? { orderCount: 0, merchandiseCents: 0 };
    bucket.orderCount += demo.orderCount;
    bucket.merchandiseCents += lineMerch;
    usByState.set(demo.state, bucket);
  }

  const usStates = mergeUsNexusStateRows(usByState);

  return {
    ...snapshot,
    usStates,
    grandOrderCount: snapshot.grandOrderCount + addedOrders,
    grandMerchandiseCents: snapshot.grandMerchandiseCents + addedMerchandiseCents,
  };
}

export function finalizeNexusPlanningSnapshot(
  snapshot: AdminNexusPlanningSnapshot,
): AdminNexusPlanningSnapshot {
  if (!nexusPlanningDemoSalesEnabled()) return snapshot;
  return applyNexusPlanningDemoSales(snapshot);
}

/** Demo rows after merge (for tests / UI copy). */
export function nexusPlanningDemoUsRows(): AdminNexusDestinationRow[] {
  return NEXUS_PLANNING_DEMO_US_SALES.map((d) => ({
    code: d.state,
    orderCount: d.orderCount,
    merchandiseCents: d.orderCount * d.unitPriceCents,
  }));
}
