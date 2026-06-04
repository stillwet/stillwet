"use server";

import { redirect } from "next/navigation";
import { getAdminSessionReadonly } from "@/lib/session";
import {
  loadAdminBadgePlatformSales,
  loadAdminBadgePromotionLists,
  loadAdminBadgeShopLeaderboardCount,
  loadAdminBadgeShopWatch,
  loadAdminHasProducts,
  loadAdminMainNavBadgeCounts,
} from "@/lib/admin-nav-badges";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/**
 * Single client fetch for all main admin nav badges + empty-catalog check.
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

/**
 * Read-only server actions used by legacy `<AdminLazyBadge>` callers.
 * Prefer {@link fetchAdminMainShellData} for new code.
 */
export async function fetchAdminBadgeShopWatchCount(): Promise<number> {
  await requireAdmin();
  return loadAdminBadgeShopWatch();
}

export async function fetchAdminBadgePromotionListsCount(): Promise<number> {
  await requireAdmin();
  return loadAdminBadgePromotionLists();
}

export async function fetchAdminBadgeShopLeaderboardCount(): Promise<number> {
  await requireAdmin();
  return loadAdminBadgeShopLeaderboardCount();
}

export async function fetchAdminBadgePlatformSalesCount(): Promise<number> {
  await requireAdmin();
  return loadAdminBadgePlatformSales();
}
