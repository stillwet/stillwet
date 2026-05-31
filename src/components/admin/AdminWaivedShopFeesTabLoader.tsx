import { AdminWaivedShopFeesTab } from "@/components/admin/AdminWaivedShopFeesTab";
import { loadAdminWaivedShopFeesDashboardPayload } from "@/lib/admin-waived-shop-fees-load";

export async function AdminWaivedShopFeesTabLoader() {
  const payload = await loadAdminWaivedShopFeesDashboardPayload();
  return <AdminWaivedShopFeesTab payload={payload} />;
}
