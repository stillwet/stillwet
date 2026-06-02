"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";

const MAX_NOTES_LENGTH = 2000;

export type AdminUpdateCreatorGiftCodeNotesResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminUpdateCreatorGiftCodeNotes(
  codeId: string,
  notesRaw: string,
): Promise<AdminUpdateCreatorGiftCodeNotesResult> {
  await requireAdmin();

  const codeIdTrimmed = codeId.trim();
  if (!codeIdTrimmed) return { ok: false, error: "Missing code id." };

  const trimmed = notesRaw.trim();
  if (trimmed.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` };
  }
  const adminNotes = trimmed.length > 0 ? trimmed : null;

  const updated = await prisma.creatorGiftCode.updateMany({
    where: { id: codeIdTrimmed },
    data: { adminNotes },
  });

  if (updated.count === 0) {
    return { ok: false, error: "Code not found." };
  }

  return { ok: true };
}
