import { AdminShopWatchTab } from "@/components/admin/AdminShopWatchTab";
import {
  loadAdminShopWatchMarketplaceStats,
  loadAdminShopWatchSummaryRows,
} from "@/lib/admin-shop-watch-load";

export async function AdminShopWatchTabLoader(props: {
  sp: Record<string, string | string[] | undefined>;
}) {
  const watchShopParam =
    typeof props.sp.watchShop === "string" && props.sp.watchShop.trim()
      ? props.sp.watchShop.trim()
      : undefined;

  const [rows, marketplaceStats] = await Promise.all([
    loadAdminShopWatchSummaryRows(),
    loadAdminShopWatchMarketplaceStats(),
  ]);

  return (
    <AdminShopWatchTab
      rows={rows}
      marketplaceStats={marketplaceStats}
      initialExpandedShopId={watchShopParam}
    />
  );
}
