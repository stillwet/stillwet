import type { DashboardPaidOrderRow } from "@/components/dashboard/DashboardMainTabs";
import { pacificCalendarDateKey } from "@/lib/promotion-period-pacific";
import { prisma } from "@/lib/prisma";

/** Bump when snapshot payload shape changes (invalidates prior daily caches). */
const SHOP_SALES_SNAPSHOT_PAYLOAD_VERSION = "v5";

export function shopSalesDashboardSnapshotPeriodKey(now: Date = new Date()): string {
  return `${pacificCalendarDateKey(now)}:${SHOP_SALES_SNAPSHOT_PAYLOAD_VERSION}`;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseSnapshotPayload(raw: unknown): DashboardPaidOrderRow[] | null {
  if (!Array.isArray(raw)) return null;
  for (const row of raw) {
    if (
      !isObject(row) ||
      typeof row.id !== "string" ||
      typeof row.orderNumber !== "number" ||
      typeof row.createdAt !== "string"
    ) {
      return null;
    }
  }
  return raw as DashboardPaidOrderRow[];
}

export async function readShopSalesDashboardSnapshot(
  shopId: string,
  periodKey: string,
): Promise<
  | { ok: true; orders: DashboardPaidOrderRow[]; builtAtIso: string; periodKey: string }
  | { ok: false }
> {
  try {
    const row = await prisma.shopSalesDashboardSnapshot.findUnique({
      where: { shopId },
      select: { periodKey: true, payload: true, builtAt: true },
    });
    if (!row || row.periodKey !== periodKey) return { ok: false };
    const parsed = parseSnapshotPayload(row.payload);
    if (!parsed) return { ok: false };
    return {
      ok: true,
      orders: parsed,
      builtAtIso: row.builtAt.toISOString(),
      periodKey: row.periodKey,
    };
  } catch (e) {
    console.warn("[salesSnapshot] read failed", e);
    return { ok: false };
  }
}

export async function writeShopSalesDashboardSnapshot(
  shopId: string,
  periodKey: string,
  orders: DashboardPaidOrderRow[],
): Promise<void> {
  await prisma.shopSalesDashboardSnapshot.upsert({
    where: { shopId },
    create: { shopId, periodKey, payload: orders, builtAt: new Date() },
    update: { periodKey, payload: orders, builtAt: new Date() },
  });
}

/** Drop cached Sales tab data so the next load reflects a new paid order. */
export async function invalidateShopSalesDashboardSnapshot(shopId: string): Promise<void> {
  try {
    await prisma.shopSalesDashboardSnapshot.deleteMany({ where: { shopId } });
  } catch (e) {
    console.warn("[salesSnapshot] invalidate failed", shopId, e);
  }
}
