"use server";

import { redirect } from "next/navigation";
import { getAdminSessionReadonly } from "@/lib/session";
import { loadAdminShopWatchShopDetails } from "@/lib/admin-shop-watch-load";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function fetchAdminShopWatchShopDetails(shopId: string) {
  await requireAdmin();
  const id = shopId.trim();
  if (!id) return { ok: false as const, error: "Missing shop id." };
  const details = await loadAdminShopWatchShopDetails(id);
  if (!details) return { ok: false as const, error: "Shop not found." };
  return { ok: true as const, details };
}
