import { NextResponse } from "next/server";
import { loadGoogleShoppingListingPicklistForShop } from "@/lib/shop-google-shopping-enrollment";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export async function GET() {
  const resolved = await resolveDashboardTabApiShop();
  if (!resolved.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: resolved.status });
  }

  const { shopId, shopSlug } = resolved.shop;
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const picklist = await loadGoogleShoppingListingPicklistForShop(shopId);
  return NextResponse.json(picklist);
}
