import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";
import type { DashboardPaidOrderRow } from "@/components/dashboard/DashboardMainTabs";
import {
  dashboardPaidOrderLineDisplayLabel,
  paidOrderLineGoodsServicesDisplayCents,
  type AdminCatalogRowForDisplay,
} from "@/lib/dashboard-payload-helpers";
import { pacificCalendarDateKey } from "@/lib/promotion-period-pacific";
import { prisma } from "@/lib/prisma";
import {
  readShopSalesDashboardSnapshot,
  writeShopSalesDashboardSnapshot,
} from "@/lib/shop-sales-dashboard-snapshot";
import {
  loadShopSalesProfitSummary,
  type ShopSalesProfitSummary,
} from "@/lib/shop-sales-profit-summary";

type OrderLineForDash = Prisma.OrderGetPayload<{
  select: {
    id: true;
    createdAt: true;
    lines: {
      select: {
        productName: true;
        quantity: true;
        unitPriceCents: true;
        goodsServicesCostCents: true;
        platformCutCents: true;
        shopCutCents: true;
        printifyVariantId: true;
        shopListing: { select: { baselineCatalogPickEncoded: true; requestItemName: true } };
        product: { select: { name: true } };
      };
    };
  };
}>;

const adminCatalogSelect = {
  id: true,
  name: true,
  itemExampleListingUrl: true,
  itemMinPriceCents: true,
  itemGoodsServicesCostCents: true,
  itemImageRequirementLabel: true,
  itemPrintAreaWidthPx: true,
  itemPrintAreaHeightPx: true,
  itemMinArtworkDpi: true,
} as const;

async function queryPaidOrdersLive(shopId: string): Promise<DashboardPaidOrderRow[]> {
  const orders = await prisma.order.findMany({
    where: { shopId, status: OrderStatus.paid },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      lines: {
        select: {
          productName: true,
          quantity: true,
          unitPriceCents: true,
          goodsServicesCostCents: true,
          platformCutCents: true,
          shopCutCents: true,
          printifyVariantId: true,
          shopListing: {
            select: { baselineCatalogPickEncoded: true, requestItemName: true },
          },
          product: { select: { name: true } },
        },
      },
    },
  });

  const ordersAdminCatalog = await prisma.adminCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminCatalogSelect,
  });
  const ordersAdminById = new Map<string, AdminCatalogRowForDisplay>(
    ordersAdminCatalog.map((r) => [r.id, { itemGoodsServicesCostCents: r.itemGoodsServicesCostCents }]),
  );

  return orders.map((o: OrderLineForDash) => ({
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    lines: o.lines.map((l) => ({
      lineDisplayLabel: dashboardPaidOrderLineDisplayLabel(l),
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      goodsServicesCostCents: paidOrderLineGoodsServicesDisplayCents(l, ordersAdminById),
      platformCutCents: l.platformCutCents,
      shopCutCents: l.shopCutCents,
    })),
  }));
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
 */
export async function loadPaidOrdersForShopDashboard(
  shopId: string,
  options?: { force?: boolean },
): Promise<LoadPaidOrdersForShopDashboardResult> {
  const periodKey = pacificCalendarDateKey();
  const profitSummary = await loadShopSalesProfitSummary(shopId);
  if (!options?.force) {
    const cached = await readShopSalesDashboardSnapshot(shopId, periodKey);
    if (cached.ok) {
      return {
        orders: cached.orders,
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
