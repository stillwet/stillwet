import { NextResponse } from "next/server";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { loadBadgeCounts } from "@/lib/dashboard-scoped-data";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";

/**
 * Lightweight notification + Support-tab badge counts for client hydration when the dashboard RSC path skips
 * {@link loadBadgeCounts} for faster Promotions-first loads.
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
    return NextResponse.json({ notificationsUnread: 0, supportNewFromStaff: 0 });
  }

  const counts = await loadBadgeCounts(row.shop.id, false);
  return NextResponse.json(counts);
}
