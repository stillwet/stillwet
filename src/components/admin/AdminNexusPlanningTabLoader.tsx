import { AdminNexusPlanningTab } from "@/components/admin/AdminNexusPlanningTab";
import { loadAdminNexusPlanningSnapshotCached } from "@/lib/admin-nexus-planning-load";
import { nexusPlanningDemoSalesEnabled } from "@/lib/admin-nexus-planning-demo";
import { loadAdminNexusRegistrationDatesByCode } from "@/lib/admin-nexus-registration-dates";
import { prisma } from "@/lib/prisma";

export async function AdminNexusPlanningTabLoader() {
  const [{ snapshot, computedAt, cacheNote }, registrationDatesByCode] = await Promise.all([
    loadAdminNexusPlanningSnapshotCached(prisma),
    loadAdminNexusRegistrationDatesByCode(),
  ]);

  return (
    <AdminNexusPlanningTab
      snapshot={snapshot}
      computedAtIso={computedAt?.toISOString() ?? null}
      cacheNote={cacheNote}
      demoSalesActive={nexusPlanningDemoSalesEnabled()}
      registrationDatesByCode={registrationDatesByCode}
    />
  );
}
