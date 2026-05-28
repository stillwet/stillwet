import { NextResponse } from "next/server";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { loadLiveListingPicklistForShop } from "@/lib/dashboard-scoped-data";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";

/**
 * Live listings eligible for listing-targeted promotions — fetch only when starting checkout for Hot / Popular.
 */
export async function GET() {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { id: true, slug: true } } },
  });
  if (!row?.shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (row.shop.slug === PLATFORM_SHOP_SLUG) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const liveListingPicklist = await loadLiveListingPicklistForShop(row.shop.id);
  return NextResponse.json({ liveListingPicklist });
}
