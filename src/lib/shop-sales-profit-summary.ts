import { Prisma } from "@/generated/prisma/client";
import { pacificMidnightUtc, pacificParts, PROMOTION_TIME_ZONE } from "@/lib/promotion-period-pacific";
import { prisma } from "@/lib/prisma";

export type ShopSalesProfitSummary = {
  monthlyProfitCents: number;
  ytdProfitCents: number;
  /** Pacific calendar month label, e.g. "June 2026". */
  monthTitle: string;
  ytdYear: number;
};

export const EMPTY_SHOP_SALES_PROFIT_SUMMARY: ShopSalesProfitSummary = {
  monthlyProfitCents: 0,
  ytdProfitCents: 0,
  monthTitle: "",
  ytdYear: new Date().getFullYear(),
};

function pacificMonthTitle(instant: Date): { monthTitle: string; ytdYear: number; y: number; m: number } {
  const { y, m } = pacificParts(instant);
  const monthTitle = new Intl.DateTimeFormat("en-US", {
    timeZone: PROMOTION_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(instant);
  return { monthTitle, ytdYear: y, y, m };
}

/** Shop profit (Σ shopCutCents + shop tip share) for Pacific calendar month and YTD. */
export async function loadShopSalesProfitSummary(
  shopId: string,
  now: Date = new Date(),
): Promise<ShopSalesProfitSummary> {
  const { monthTitle, ytdYear, y, m } = pacificMonthTitle(now);
  const monthStart = pacificMidnightUtc(y, m, 1);
  const ytdStart = pacificMidnightUtc(y, 1, 1);

  const rows = await prisma.$queryRaw<{ monthProfitCents: bigint; ytdProfitCents: bigint }[]>(
    Prisma.sql`
      SELECT
        (
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${monthStart} THEN ol."shopCutCents" ELSE 0 END), 0)
          + COALESCE((
              SELECT SUM(
                CASE
                  WHEN o2."tipCents" > 0 THEN o2."tipCents"
                  ELSE 0
                END
              )
              FROM "Order" o2
              WHERE o2."shopId" = ${shopId}
                AND o2.status = 'paid'
                AND o2."createdAt" >= ${monthStart}
            ), 0)
        )::bigint AS "monthProfitCents",
        (
          COALESCE(SUM(CASE WHEN o."createdAt" >= ${ytdStart} THEN ol."shopCutCents" ELSE 0 END), 0)
          + COALESCE((
              SELECT SUM(
                CASE
                  WHEN o2."tipCents" > 0 THEN o2."tipCents"
                  ELSE 0
                END
              )
              FROM "Order" o2
              WHERE o2."shopId" = ${shopId}
                AND o2.status = 'paid'
                AND o2."createdAt" >= ${ytdStart}
            ), 0)
        )::bigint AS "ytdProfitCents"
      FROM "OrderLine" ol
      INNER JOIN "Order" o ON o.id = ol."orderId"
      WHERE o."shopId" = ${shopId}
        AND o.status = 'paid'
    `,
  );

  const row = rows[0];
  return {
    monthlyProfitCents: Number(row?.monthProfitCents ?? 0),
    ytdProfitCents: Number(row?.ytdProfitCents ?? 0),
    monthTitle,
    ytdYear,
  };
}
