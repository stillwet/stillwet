"use server";

import { redirect } from "next/navigation";
import { CreatorGiftCodeType } from "@/generated/prisma/enums";
import { createBetaTesterInviteCodes } from "@/lib/beta-tester-codes";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";

const ALLOWED_COUNTS = new Set([1, 10]);

export type AdminGenerateBetaTesterCodesResult =
  | { ok: true; count: number; codes: string[] }
  | { ok: false; error: string };

export type AdminDeleteBetaTesterCodeResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminGenerateBetaTesterCodes(
  _prev: AdminGenerateBetaTesterCodesResult | undefined,
  formData: FormData,
): Promise<AdminGenerateBetaTesterCodesResult> {
  await requireAdmin();

  const count = Number.parseInt(String(formData.get("count") ?? ""), 10);
  if (!ALLOWED_COUNTS.has(count)) {
    return { ok: false, error: "Code count must be 1 or 10." };
  }

  try {
    const { codes } = await createBetaTesterInviteCodes(count);
    revalidateAdminViews();
    return { ok: true, count: codes.length, codes };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not generate beta tester codes.";
    return { ok: false, error: message };
  }
}

export async function adminDeleteBetaTesterCode(
  _prev: AdminDeleteBetaTesterCodeResult | undefined,
  formData: FormData,
): Promise<AdminDeleteBetaTesterCodeResult> {
  await requireAdmin();

  const codeId = String(formData.get("codeId") ?? "").trim();
  if (!codeId) return { ok: false, error: "Missing code id." };

  const deleted = await prisma.creatorGiftCode.deleteMany({
    where: {
      id: codeId,
      type: CreatorGiftCodeType.shop_setup,
      redeemedAt: null,
      purchase: { isBetaTesterBatch: true },
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      error: "That code is not an unused beta tester invite, or it was already removed.",
    };
  }

  revalidateAdminViews();
  return { ok: true };
}
