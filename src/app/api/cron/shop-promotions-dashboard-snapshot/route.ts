import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rebuildShopPromotionsDashboardSnapshot } from "@/lib/dashboard-scoped-data";

function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !isVercelCron(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const grouped = await prisma.promotionPurchase.groupBy({
    by: ["shopId"],
  });

  let okCount = 0;
  const errors: Array<{ shopId: string; error: string }> = [];
  for (const g of grouped) {
    try {
      await rebuildShopPromotionsDashboardSnapshot(g.shopId);
      okCount += 1;
    } catch (e) {
      errors.push({
        shopId: g.shopId,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    shops: okCount,
    errors,
  });
}

