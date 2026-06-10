"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeaturePollOptionFollowUpKind, FeaturePollOptionStatus } from "@/generated/prisma/enums";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";
import {
  FEATURE_POLL_FOLLOWUP_MIGRATION_ID,
  FEATURE_POLL_RADIO_FOLLOWUP_MIGRATION_ID,
} from "@/lib/feature-poll-types";
import { FEATURE_POLL_PATH } from "@/lib/feature-poll-path";
import {
  parseFollowUpChoicesText,
  serializeFollowUpChoicesText,
} from "@/lib/feature-poll-follow-up-choices";
import { isFeaturePollFollowUpSchemaDriftError } from "@/lib/prisma-missing-relation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";

function redirectWithFlash(params: Record<string, string>) {
  const q = new URLSearchParams({ tab: "feature-votes", ...params });
  redirect(`${ADMIN_BACKEND_BASE_PATH}?${q.toString()}`);
}

function revalidateFeaturePollPaths() {
  revalidatePath(FEATURE_POLL_PATH);
  revalidatePath(ADMIN_BACKEND_BASE_PATH);
}

async function requireAdmin() {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");
}

function parseSortOrder(raw: FormDataEntryValue | null): number {
  const n = parseInt(String(raw ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionStatus(raw: FormDataEntryValue | null): FeaturePollOptionStatus {
  const v = String(raw ?? "").trim();
  if (v === FeaturePollOptionStatus.completed) return FeaturePollOptionStatus.completed;
  if (v === FeaturePollOptionStatus.removed) return FeaturePollOptionStatus.removed;
  return FeaturePollOptionStatus.active;
}

function parseFollowUpKind(raw: FormDataEntryValue | null): FeaturePollOptionFollowUpKind {
  const v = String(raw ?? "").trim();
  if (v === FeaturePollOptionFollowUpKind.free_text) {
    return FeaturePollOptionFollowUpKind.free_text;
  }
  if (v === FeaturePollOptionFollowUpKind.country_select) {
    return FeaturePollOptionFollowUpKind.country_select;
  }
  if (v === FeaturePollOptionFollowUpKind.radio_select) {
    return FeaturePollOptionFollowUpKind.radio_select;
  }
  return FeaturePollOptionFollowUpKind.none;
}

function parseFollowUpFields(formData: FormData): {
  followUpKind: FeaturePollOptionFollowUpKind;
  followUpPrompt: string | null;
  followUpChoices: string | null;
} | { error: string } {
  const followUpKind = parseFollowUpKind(formData.get("followUpKind"));
  const followUpPromptRaw = String(formData.get("followUpPrompt") ?? "").trim();
  const followUpChoicesRaw = String(formData.get("followUpChoices") ?? "");

  if (followUpKind === FeaturePollOptionFollowUpKind.none) {
    return { followUpKind, followUpPrompt: null, followUpChoices: null };
  }

  if (!followUpPromptRaw) {
    return { error: "Follow-up prompt is required when a follow-up type is set." };
  }

  if (followUpKind === FeaturePollOptionFollowUpKind.radio_select) {
    const choices = parseFollowUpChoicesText(followUpChoicesRaw);
    if (choices.length < 2) {
      return { error: "Add at least two radio options (one per line)." };
    }
    return {
      followUpKind,
      followUpPrompt: followUpPromptRaw.slice(0, 500),
      followUpChoices: serializeFollowUpChoicesText(choices),
    };
  }

  return {
    followUpKind,
    followUpPrompt: followUpPromptRaw.slice(0, 500),
    followUpChoices: null,
  };
}

export async function adminCreateFeaturePollQuestionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) redirectWithFlash({ fp_err: "Question prompt is required." });

  const maxSort = await prisma.featurePollQuestion.aggregate({ _max: { sortOrder: true } });
  await prisma.featurePollQuestion.create({
    data: {
      prompt: prompt.slice(0, 500),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "question_added" });
}

export async function adminUpdateFeaturePollQuestionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("questionId") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!id || !prompt) redirectWithFlash({ fp_err: "Missing question data." });

  await prisma.featurePollQuestion.update({
    where: { id },
    data: {
      prompt: prompt.slice(0, 500),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      active: formData.get("active") === "on",
    },
  });
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "question_updated" });
}

export async function adminDeleteFeaturePollQuestionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("questionId") ?? "").trim();
  if (!id) redirectWithFlash({ fp_err: "Missing question id." });
  await prisma.featurePollQuestion.delete({ where: { id } });
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "question_deleted" });
}

export async function adminCreateFeaturePollOptionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const questionId = String(formData.get("questionId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!questionId || !label) redirectWithFlash({ fp_err: "Option label is required." });

  const maxSort = await prisma.featurePollOption.aggregate({
    where: { questionId },
    _max: { sortOrder: true },
  });
  await prisma.featurePollOption.create({
    data: {
      questionId,
      label: label.slice(0, 300),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "option_added" });
}

export async function adminUpdateFeaturePollOptionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("optionId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!id || !label) redirectWithFlash({ fp_err: "Missing option data." });

  const followUpFields = parseFollowUpFields(formData);
  if ("error" in followUpFields) {
    redirectWithFlash({ fp_err: followUpFields.error });
    return;
  }

  const baseData = {
    label: label.slice(0, 300),
    sortOrder: parseSortOrder(formData.get("sortOrder")),
    status: parseOptionStatus(formData.get("status")),
  };

  try {
    await prisma.featurePollOption.update({
      where: { id },
      data: {
        ...baseData,
        followUpKind: followUpFields.followUpKind,
        followUpPrompt: followUpFields.followUpPrompt,
        followUpChoices: followUpFields.followUpChoices,
      },
    });
  } catch (e) {
    if (!isFeaturePollFollowUpSchemaDriftError(e)) throw e;
    await prisma.featurePollOption.update({ where: { id }, data: baseData });
    if (followUpFields.followUpKind === FeaturePollOptionFollowUpKind.radio_select) {
      redirectWithFlash({
        fp_err: `Radio follow-ups require migration ${FEATURE_POLL_RADIO_FOLLOWUP_MIGRATION_ID}, npx prisma generate, and a redeploy. Other option fields were saved.`,
      });
      return;
    }
    if (followUpFields.followUpKind !== FeaturePollOptionFollowUpKind.none) {
      redirectWithFlash({
        fp_err: `Follow-up settings require migration ${FEATURE_POLL_FOLLOWUP_MIGRATION_ID}. Other option fields were saved.`,
      });
      return;
    }
  }
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "option_updated" });
}

export async function adminDeleteFeaturePollOptionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("optionId") ?? "").trim();
  if (!id) redirectWithFlash({ fp_err: "Missing option id." });
  await prisma.featurePollOption.delete({ where: { id } });
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "option_deleted" });
}

export async function adminMoveFeaturePollQuestionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("questionId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!id || (direction !== "up" && direction !== "down")) {
    redirectWithFlash({ fp_err: "Invalid reorder." });
  }

  const questions = await prisma.featurePollQuestion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, sortOrder: true },
  });
  const idx = questions.findIndex((q) => q.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= questions.length) {
    redirectWithFlash({ fp_saved: "reordered" });
  }

  const a = questions[idx]!;
  const b = questions[swapIdx]!;
  await prisma.$transaction([
    prisma.featurePollQuestion.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.featurePollQuestion.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "reordered" });
}

export async function adminMoveFeaturePollOptionForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("optionId") ?? "").trim();
  const questionId = String(formData.get("questionId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!id || !questionId || (direction !== "up" && direction !== "down")) {
    redirectWithFlash({ fp_err: "Invalid reorder." });
  }

  const options = await prisma.featurePollOption.findMany({
    where: { questionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, sortOrder: true },
  });
  const idx = options.findIndex((o) => o.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= options.length) {
    redirectWithFlash({ fp_saved: "reordered" });
  }

  const a = options[idx]!;
  const b = options[swapIdx]!;
  await prisma.$transaction([
    prisma.featurePollOption.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.featurePollOption.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
  revalidateFeaturePollPaths();
  redirectWithFlash({ fp_saved: "reordered" });
}
