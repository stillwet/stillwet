"use server";

import { redirect } from "next/navigation";
import { getAdminSessionReadonly } from "@/lib/session";
import {
  loadAdminHasProducts,
  loadAdminMainNavBadgeCounts,
} from "@/lib/admin-nav-badges";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/**
 * Single client fetch for main admin nav badges + empty-catalog check.
 * Keeps the admin shell render free of Neon aggregate queries.
 */
export async function fetchAdminMainShellData() {
  await requireAdmin();
  const [badges, hasProducts] = await Promise.all([
    loadAdminMainNavBadgeCounts(),
    loadAdminHasProducts(),
  ]);
  return { ...badges, hasProducts };
}
