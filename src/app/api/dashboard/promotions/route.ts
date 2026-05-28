import { NextResponse } from "next/server";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { loadPromotionsSummaryForShop } from "@/lib/dashboard-scoped-data";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";

/**
 * Lightweight Promotions tab payload: purchase history (with lifecycle) + Stripe/mock flags only.
 * Checkout uses client-side period pricing; platform caps are enforced when payment starts.
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

  const shopId = row.shop.id;
  const t0 = Date.now();
  const payload = await loadPromotionsSummaryForShop(shopId, row.shop.slug);
  const totalMs = Date.now() - t0;

  if (process.env.NODE_ENV === "production" && totalMs >= 3000) {
    console.warn("[promotionsApi] slow GET /api/dashboard/promotions", { totalMs });
  }

  return NextResponse.json(payload);
}
