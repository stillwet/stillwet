"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminFreezeShopById, adminUnfreezeShopById } from "@/lib/admin-shop-freeze";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";

export type AdminShopFreezeActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

function revalidateFrozenShopPaths(slug: string) {
  revalidateAdminViews();
  revalidatePath(`/s/${slug}`);
  revalidatePath("/shops");
  revalidatePath("/dashboard");
}

export async function adminFreezeShop(
  _prev: AdminShopFreezeActionResult | undefined,
  formData: FormData,
): Promise<AdminShopFreezeActionResult> {
  await requireAdmin();

  const shopId = String(formData.get("shopId") ?? "").trim();
  if (!shopId) return { ok: false, error: "Missing shop id." };

  const result = await adminFreezeShopById(shopId);
  if (!result.ok) return result;

  revalidateFrozenShopPaths(result.slug);
  return { ok: true };
}

export async function adminUnfreezeShop(
  _prev: AdminShopFreezeActionResult | undefined,
  formData: FormData,
): Promise<AdminShopFreezeActionResult> {
  await requireAdmin();

  const shopId = String(formData.get("shopId") ?? "").trim();
  if (!shopId) return { ok: false, error: "Missing shop id." };

  const result = await adminUnfreezeShopById(shopId);
  if (!result.ok) return result;

  revalidateFrozenShopPaths(result.slug);
  return { ok: true };
}
