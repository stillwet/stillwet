import { NextResponse } from "next/server";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { loadPromotionCheckoutSlotUiForKind } from "@/lib/dashboard-scoped-data";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import { PromotionKind } from "@/generated/prisma/enums";
import { parsePromotionKind } from "@/lib/promotions";

/**
 * Slot counts + pricing for one promotion kind when starting checkout (lazy-loaded).
 */
export async function GET(req: Request) {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { slug: true } } },
  });
  if (!row?.shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (row.shop.slug === PLATFORM_SHOP_SLUG) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const kind = parsePromotionKind(url.searchParams.get("kind") ?? "");
  if (
    !kind ||
    (kind !== PromotionKind.HOT_FEATURED_ITEM &&
      kind !== PromotionKind.FEATURED_SHOP_HOME &&
      kind !== PromotionKind.MOST_POPULAR_OF_TAG_ITEM)
  ) {
    return NextResponse.json({ error: "Invalid promotion kind" }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const payload = await loadPromotionCheckoutSlotUiForKind(kind, row.shop.slug);
    const totalMs = Date.now() - t0;
    if (totalMs >= 3000) {
      console.warn("[promotionsApi] slow GET checkout-context", { kind, totalMs });
    }
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[promotionsApi] checkout-context", { kind, totalMs: Date.now() - t0, msg });
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 500 });
  }
}
