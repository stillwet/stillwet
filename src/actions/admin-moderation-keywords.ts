"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { prisma, prismaModerationKeywordOrNull } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { normalizeModerationPhraseKey } from "@/lib/moderation-keyword-scan";

export type AdminModerationKeywordActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function adminAddModerationKeyword(
  formData: FormData,
): Promise<AdminModerationKeywordActionResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const phrase = String(formData.get("phrase") ?? "").trim();
  if (!phrase) return { ok: false, error: "Phrase is required." };

  const phraseNormalized = normalizeModerationPhraseKey(phrase);
  if (!phraseNormalized) return { ok: false, error: "Phrase is required." };

  const moderationKeyword = prismaModerationKeywordOrNull();
  if (!moderationKeyword) {
    return {
      ok: false,
      error:
        "Keyword triggers are unavailable until the database migration is applied (20260516120000_moderation_keyword) and the app is redeployed.",
    };
  }

  try {
    await moderationKeyword.create({
      data: { phrase, phraseNormalized },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That phrase is already on the list (case-insensitive match)." };
    }
    throw e;
  }

  revalidateAdminViews();
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function adminDeleteModerationKeyword(
  formData: FormData,
): Promise<AdminModerationKeywordActionResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const id = String(formData.get("keywordId") ?? "").trim();
  if (!id) return { ok: false, error: "Missing phrase id." };

  const moderationKeyword = prismaModerationKeywordOrNull();
  if (!moderationKeyword) {
    return {
      ok: false,
      error:
        "Keyword triggers are unavailable until the database migration is applied (20260516120000_moderation_keyword) and the app is redeployed.",
    };
  }

  const existing = await moderationKeyword.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Phrase not found." };

  await moderationKeyword.delete({ where: { id } });
  revalidateAdminViews();
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function adminAddModerationKeywordForm(formData: FormData): Promise<void> {
  const r = await adminAddModerationKeyword(formData);
  if (!r.ok) {
    redirect(
      `${ADMIN_BACKEND_BASE_PATH}?tab=keyword-triggers&kw_err=${encodeURIComponent(r.error)}#keyword-triggers`,
    );
  }
  redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=keyword-triggers&kw_saved=added#keyword-triggers`);
}

export async function adminDeleteModerationKeywordForm(formData: FormData): Promise<void> {
  const r = await adminDeleteModerationKeyword(formData);
  if (!r.ok) {
    redirect(
      `${ADMIN_BACKEND_BASE_PATH}?tab=keyword-triggers&kw_err=${encodeURIComponent(r.error)}#keyword-triggers`,
    );
  }
  redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=keyword-triggers&kw_saved=deleted#keyword-triggers`);
}
