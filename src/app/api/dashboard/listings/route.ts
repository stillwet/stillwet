import { NextResponse } from "next/server";
import { loadDashboardListingsTab, loadDashboardPlatformListingsTab } from "@/lib/dashboard-scoped-data";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";

export async function GET() {
  try {
    const resolved = await resolveDashboardTabApiShop();
    if (!resolved.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: resolved.status });
    }

    const { shopId, shopSlug, isPlatform } = resolved.shop;
    if (!isPlatform) {
      await syncFreeListingFeeWaivers(shopId);
    }

    const chunks = isPlatform
      ? await loadDashboardPlatformListingsTab(shopId)
      : await loadDashboardListingsTab(shopId, shopSlug);

    return NextResponse.json({
      listings: chunks.listingRows,
      groupedListingSections: chunks.groupedListingSections,
      moderationKeywordPhrases: chunks.moderationKeywordPhrases,
    });
  } catch (e) {
    console.error("[api/dashboard/listings]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
