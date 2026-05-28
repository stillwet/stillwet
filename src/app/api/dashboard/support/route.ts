import { NextResponse } from "next/server";
import { loadDashboardSupportTab } from "@/lib/dashboard-scoped-data";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";

export async function GET() {
  const resolved = await resolveDashboardTabApiShop();
  if (!resolved.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: resolved.status });
  }
  if (resolved.shop.isPlatform) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chunks = await loadDashboardSupportTab(resolved.shop.shopId, resolved.shop.shopSlug);

  return NextResponse.json({
    supportChat: chunks.supportChat,
  });
}
