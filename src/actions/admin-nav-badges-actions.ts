"use server";

import { redirect } from "next/navigation";
import { getAdminSessionReadonly } from "@/lib/session";
import {
  loadAdminBadgePlatformSales,
  loadAdminBadgePromotionLists,
  loadAdminBadgeShopLeaderboardCount,
  loadAdminBadgeShopWatch,
} from "@/lib/admin-nav-badges";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/**
 * Read-only server actions used by `<AdminLazyBadge>` to fetch heavy admin nav badge counts
 * from the client AFTER the admin page has rendered. Keeping these out of the page render path
 * prevents the admin shell — and especially the post-mutation revalidation render — from being
 * blocked on the slowest aggregate query.
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
