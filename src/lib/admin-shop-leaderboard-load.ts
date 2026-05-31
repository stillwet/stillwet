import { unstable_cache } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AdminShopLeaderboardRow } from "@/components/admin/AdminShopLeaderboardTab";

const LEADERBOARD_CACHE_S = 60 * 60 * 2;

type ShopLeaderboardQueryRow = {
  shopId: string;
  displayName: string;
  slug: string;
  merchandiseCents: bigint;
  shopCutCents: bigint;
  lineCount: number;
};

function leaderboardCacheKey(salesFromIso: string, salesToIso: string): string {
  return `admin-shop-leaderboard:v1:${salesFromIso}:${salesToIso}`;
}

async function loadShopLeaderboardRowsUncached(
  leaderboardOrderDateSql: Prisma.Sql,
): Promise<AdminShopLeaderboardRow[]> {
  const rowBlock = await prisma.$queryRaw<ShopLeaderboardQueryRow[]>`
    SELECT
      s.id AS "shopId",
      s."displayName" AS "displayName",
      s.slug AS "slug",
      SUM(ol.quantity * ol."unitPriceCents")::bigint AS "merchandiseCents",
      SUM(ol."shopCutCents")::bigint AS "shopCutCents",
      COUNT(*)::int AS "lineCount"
    FROM "OrderLine" ol
    INNER JOIN "Order" o ON o.id = ol."orderId"
    INNER JOIN "Shop" s ON s.id = ol."shopId"
    WHERE o.status = 'paid'
      ${leaderboardOrderDateSql}
    GROUP BY s.id, s."displayName", s.slug
    HAVING SUM(ol.quantity * ol."unitPriceCents") > 0
    ORDER BY SUM(ol.quantity * ol."unitPriceCents") DESC
  `;
  return rowBlock.map((r, i) => ({
    rank: i + 1,
    displayName: r.displayName,
    slug: r.slug,
    merchandiseCents: Number(r.merchandiseCents),
    shopCutCents: Number(r.shopCutCents),
    platformProfitCents: Math.max(0, Number(r.merchandiseCents) - Number(r.shopCutCents)),
    paidLineCount: Number(r.lineCount),
  }));
}

/** Cached shop leaderboard rows — tab body only; badge count uses {@link loadAdminBadgeShopLeaderboardCount}. */
export async function loadAdminShopLeaderboardRows(args: {
  salesFrom?: Date;
  salesTo?: Date;
}): Promise<AdminShopLeaderboardRow[]> {
  const salesFromIso = args.salesFrom?.toISOString() ?? "";
  const salesToIso = args.salesTo?.toISOString() ?? "";
  const leaderboardOrderDateSql: Prisma.Sql =
    args.salesFrom && args.salesTo
      ? Prisma.sql`AND o."createdAt" >= ${args.salesFrom} AND o."createdAt" <= ${args.salesTo}`
      : args.salesFrom
        ? Prisma.sql`AND o."createdAt" >= ${args.salesFrom}`
        : args.salesTo
          ? Prisma.sql`AND o."createdAt" <= ${args.salesTo}`
          : Prisma.sql``;

  return unstable_cache(
    () => loadShopLeaderboardRowsUncached(leaderboardOrderDateSql),
    [leaderboardCacheKey(salesFromIso, salesToIso)],
    { revalidate: LEADERBOARD_CACHE_S },
  )();
}
