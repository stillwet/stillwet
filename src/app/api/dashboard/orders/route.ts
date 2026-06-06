import { NextResponse } from "next/server";
import {
  loadDashboardPlatformOrdersTab,
} from "@/lib/dashboard-scoped-data";
import { loadPaidOrdersForShopDashboard } from "@/lib/load-paid-orders-for-shop-dashboard";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";

export async function GET(req: Request) {
  const resolved = await resolveDashboardTabApiShop();
  if (!resolved.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: resolved.status });
  }

  const force = new URL(req.url).searchParams.get("refresh") === "1";

  if (resolved.shop.isPlatform) {
    const chunks = await loadDashboardPlatformOrdersTab(resolved.shop.shopId);
    return NextResponse.json({
      orders: chunks.paidOrders,
      profitSummary: null,
      periodKey: null,
      builtAtIso: null,
      fromCache: false,
    });
  }

  const result = await loadPaidOrdersForShopDashboard(resolved.shop.shopId, { force });

  return NextResponse.json({
    orders: result.orders,
    profitSummary: result.profitSummary,
    periodKey: result.periodKey,
    builtAtIso: result.builtAtIso,
    fromCache: result.fromCache,
  });
}
