import { revalidatePath } from "next/cache";
import {
  DASHBOARD_LEGACY_PROMOTIONS_PATH,
  DASHBOARD_PROMOTIONS_PATH,
} from "@/lib/dashboard-promotions-path";

/** Revalidate shop upgrades page (current + legacy URL for redirects). */
export function revalidateShopUpgradesDashboardPaths(): void {
  revalidatePath(DASHBOARD_PROMOTIONS_PATH);
  revalidatePath(DASHBOARD_LEGACY_PROMOTIONS_PATH);
}
