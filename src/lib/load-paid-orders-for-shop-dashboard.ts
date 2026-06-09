import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import type { DashboardPaidOrderRow } from "@/components/dashboard/DashboardMainTabs";
import { dashboardPaidOrderLineDisplayLabel } from "@/lib/dashboard-payload-helpers";
import { splitCheckoutTipCents } from "@/lib/checkout-tip";
import { prisma } from "@/lib/prisma";
import {
  readShopSalesDashboardSnapshot,
  shopSalesDashboardSnapshotPeriodKey,
  writeShopSalesDashboardSnapshot,
} from "@/lib/shop-sales-dashboard-snapshot";
import {
  loadShopSalesProfitSummary,
  type ShopSalesProfitSummary,
} from "@/lib/shop-sales-profit-summary";

function mapOrderToPaidOrderRow(o: OrderLineForDash): DashboardPaidOrderRow {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    tipCents: o.tipCents,
    shopTipCents: splitCheckoutTipCents(o.tipCents).shopTipCents,
    lines: o.lines.map((l) => ({
      lineDisplayLabel: dashboardPaidOrderLineDisplayLabel(l),
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      goodsServicesCostCents: l.goodsServicesCostCents,
      platformCutCents: l.platformCutCents,
      shopCutCents: l.shopCutCents,
    })),
  };
}

/** Merge live tip fields so cached order rows match profit summary SQL. */
async function hydratePaidOrderRowTips(
  orders: DashboardPaidOrderRow[],
): Promise<DashboardPaidOrderRow[]> {
  if (orders.length === 0) return orders;

  const tipsByOrderId = new Map(
    (
      await prisma.order.findMany({
        where: { id: { in: orders.map((o) => o.id) } },
        select: { id: true, tipCents: true },
      })
    ).map((o) => [o.id, o.tipCents] as const),
  );

  return orders.map((o) => {
    const tipCents = tipsByOrderId.get(o.id) ?? o.tipCents ?? 0;
    const shopTipCents = splitCheckoutTipCents(tipCents).shopTipCents;
    if (o.tipCents === tipCents && o.shopTipCents === shopTipCents) return o;
    return { ...o, tipCents, shopTipCents };
  });
}

type OrderLineForDash = Prisma.OrderGetPayload<{
  select: {
    id: true;
    orderNumber: true;
    createdAt: true;
    tipCents: true;
    lines: {
      select: {
        productName: true;
        quantity: true;
        unitPriceCents: true;
        goodsServicesCostCents: true;
        platformCutCents: true;
        shopCutCents: true;
        shopListing: { select: { requestItemName: true } };
        product: { select: { name: true } };
      };
    };
  };
}>;

async function queryPaidOrdersLive(shopId: string): Promise<DashboardPaidOrderRow[]> {
  const orders = await prisma.order.findMany({
    where: { shopId, status: OrderStatus.paid },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      tipCents: true,
      lines: {
        select: {
          productName: true,
          quantity: true,
          unitPriceCents: true,
          goodsServicesCostCents: true,
          platformCutCents: true,
          shopCutCents: true,
          shopListing: {
            select: { requestItemName: true },
          },
          product: { select: { name: true } },
        },
      },
    },
  });

  return orders.map((o: OrderLineForDash) => mapOrderToPaidOrderRow(o));
}

export type LoadPaidOrdersForShopDashboardResult = {
  orders: DashboardPaidOrderRow[];
  profitSummary: ShopSalesProfitSummary;
  periodKey: string;
  builtAtIso: string | null;
  fromCache: boolean;
};

/**
 * Sales tab data: at most one live Postgres rebuild per shop per Pacific calendar day.
 * Pass `force: true` (debug) to bypass the snapshot.
 * Profit summary cards are always computed live from Postgres.
 */
export async function loadPaidOrdersForShopDashboard(
  shopId: string,
  options?: { force?: boolean },
): Promise<LoadPaidOrdersForShopDashboardResult> {
  const periodKey = shopSalesDashboardSnapshotPeriodKey();
  const profitSummary = await loadShopSalesProfitSummary(shopId);
  if (!options?.force) {
    const cached = await readShopSalesDashboardSnapshot(shopId, periodKey);
    if (cached.ok) {
      const orders = await hydratePaidOrderRowTips(cached.orders);
      return {
        orders,
        profitSummary,
        periodKey: cached.periodKey,
        builtAtIso: cached.builtAtIso,
        fromCache: true,
      };
    }
  }

  const orders = await queryPaidOrdersLive(shopId);
  await writeShopSalesDashboardSnapshot(shopId, periodKey, orders);
  return {
    orders,
    profitSummary,
    periodKey,
    builtAtIso: new Date().toISOString(),
    fromCache: false,
  };
}
