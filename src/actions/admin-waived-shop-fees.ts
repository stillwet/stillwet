"use server";

import { redirect } from "next/navigation";
import { CreatorGiftCodeType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";
import { createWaivedShopFeeInviteCode } from "@/lib/waived-shop-fee-codes";

export type AdminGenerateWaivedShopFeeCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export type AdminDeleteWaivedShopFeeCodeResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminGenerateWaivedShopFeeCode(
  _prev: AdminGenerateWaivedShopFeeCodeResult | undefined,
  _formData: FormData,
): Promise<AdminGenerateWaivedShopFeeCodeResult> {
  await requireAdmin();

  try {
    const { code } = await createWaivedShopFeeInviteCode();
    revalidateAdminViews();
    return { ok: true, code };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not generate waived shop fee code.";
    return { ok: false, error: message };
  }
}

export async function adminDeleteWaivedShopFeeCode(
  _prev: AdminDeleteWaivedShopFeeCodeResult | undefined,
  formData: FormData,
): Promise<AdminDeleteWaivedShopFeeCodeResult> {
  await requireAdmin();

  const codeId = String(formData.get("codeId") ?? "").trim();
  if (!codeId) return { ok: false, error: "Missing code id." };

  const deleted = await prisma.creatorGiftCode.deleteMany({
    where: {
      id: codeId,
      type: CreatorGiftCodeType.shop_setup,
      redeemedAt: null,
      purchase: { isWaivedShopFeeBatch: true },
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      error: "That code is not an unused waived shop fee invite, or it was already removed.",
    };
  }

  revalidateAdminViews();
  return { ok: true };
}
