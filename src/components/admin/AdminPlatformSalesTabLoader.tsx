import { AdminPlatformSalesTab } from "@/components/admin/AdminPlatformSalesTab";
import {
  loadMergedPlatformSalesLines,
  loadPlatformSalesCurrentMonthTotals,
  loadPlatformSalesCurrentQuarterTotals,
  loadPlatformSalesMonthlyAverageTotals,
  loadPlatformSalesYtdTotalsHybrid,
  platformSalesUtcMonthTitles,
} from "@/lib/admin-platform-sales-merged-lines";
import { prisma } from "@/lib/prisma";

function parseIsoDateBoundary(s: string): Date | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function AdminPlatformSalesTabLoader(props: {
  sp: Record<string, string | string[] | undefined>;
}) {
  const salesFromRaw = typeof props.sp.salesFrom === "string" ? props.sp.salesFrom : "";
  const salesToRaw = typeof props.sp.salesTo === "string" ? props.sp.salesTo : "";
  const salesKindRaw = typeof props.sp.salesKind === "string" ? props.sp.salesKind.trim() : "";
  const salesKindFilter: "all" | "listing" | "item" | "support" | "promotion" | "shop_creation" =
    salesKindRaw === "listing" ||
    salesKindRaw === "item" ||
    salesKindRaw === "support" ||
    salesKindRaw === "promotion" ||
    salesKindRaw === "shop_creation"
      ? salesKindRaw
      : "all";

  const salesFrom = parseIsoDateBoundary(salesFromRaw);
  const salesTo = parseIsoDateBoundary(salesToRaw);
  const salesOrderCreatedAt =
    salesFrom || salesTo
      ? {
          ...(salesFrom ? { gte: salesFrom } : {}),
          ...(salesTo ? { lte: salesTo } : {}),
        }
      : undefined;

  const clearSalesHistoryEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_ADMIN_CLEAR_SALES_HISTORY?.trim() === "true";

  const bundle = await loadMergedPlatformSalesLines(prisma, {
    salesOrderCreatedAt,
  });
  const merged = bundle.lines;
  const platformSalesTabLines =
    salesKindFilter === "all"
      ? merged
      : merged.filter((l) => l.platformSaleCategory === salesKindFilter);

  const salesClock = new Date();
  const titles = platformSalesUtcMonthTitles(salesClock);
  const [currentTotals, currentQuarterTotals, ytdTotals, monthlyAverage] = await Promise.all([
    loadPlatformSalesCurrentMonthTotals(prisma, salesClock),
    loadPlatformSalesCurrentQuarterTotals(prisma, salesClock),
    loadPlatformSalesYtdTotalsHybrid(salesClock),
    loadPlatformSalesMonthlyAverageTotals(prisma, salesClock),
  ]);

  return (
    <AdminPlatformSalesTab
      lines={platformSalesTabLines}
      salesFromValue={salesFromRaw}
      salesToValue={salesToRaw}
      salesKind={salesKindFilter}
      monthSummaries={{
        ...titles,
        currentTotals,
        currentQuarterTotals,
        ytdTotals,
        monthlyAverage,
      }}
      clearSalesHistoryEnabled={clearSalesHistoryEnabled}
    />
  );
}
