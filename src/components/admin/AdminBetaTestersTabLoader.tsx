import { AdminBetaTestersTab } from "@/components/admin/AdminBetaTestersTab";
import { loadAdminBetaTesterDashboardPayload } from "@/lib/admin-beta-testers-load";

export async function AdminBetaTestersTabLoader() {
  const payload = await loadAdminBetaTesterDashboardPayload();
  return <AdminBetaTestersTab payload={payload} />;
}
