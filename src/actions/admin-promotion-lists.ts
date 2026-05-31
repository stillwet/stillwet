"use server";

import { redirect } from "next/navigation";
import type { PromotionKind } from "@/generated/prisma/enums";
import { getAdminSessionReadonly } from "@/lib/session";
import {
  loadAdminFeaturedProductPicker,
  loadAdminPermanentFeaturedProductPicker,
} from "@/lib/admin-promotion-lists-load";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function fetchAdminFeaturedProductPicker(kind: PromotionKind) {
  await requireAdmin();
  return loadAdminFeaturedProductPicker(kind);
}

export async function fetchAdminPermanentFeaturedProductPicker() {
  await requireAdmin();
  return loadAdminPermanentFeaturedProductPicker();
}
