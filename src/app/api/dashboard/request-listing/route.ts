import { NextResponse } from "next/server";
import { loadDashboardRequestListingTab } from "@/lib/dashboard-scoped-data";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";

export async function GET() {
  const resolved = await resolveDashboardTabApiShop();
  if (!resolved.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: resolved.status });
  }
  if (resolved.shop.isPlatform) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await syncFreeListingFeeWaivers(resolved.shop.shopId);

  const chunks = await loadDashboardRequestListingTab(
    resolved.shop.shopId,
    resolved.shop.shopSlug,
  );

  return NextResponse.json({
    requestListingCatalog: chunks.requestListingCatalog,
    moderationKeywordPhrases: chunks.moderationKeywordPhrases,
  });
}
