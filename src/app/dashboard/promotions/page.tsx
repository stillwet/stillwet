import { redirect } from "next/navigation";
import { DASHBOARD_PROMOTIONS_PATH } from "@/lib/dashboard-promotions-path";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Bookmarks to `/dashboard/promotions` keep working after the rename to Shop Upgrades. */
export default async function LegacyDashboardPromotionsRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (typeof raw === "string" && raw.length > 0) {
      p.set(key, raw);
      continue;
    }
    if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].length > 0) {
      p.set(key, raw[0]);
    }
  }
  const q = p.toString();
  redirect(q ? `${DASHBOARD_PROMOTIONS_PATH}?${q}` : DASHBOARD_PROMOTIONS_PATH);
}
