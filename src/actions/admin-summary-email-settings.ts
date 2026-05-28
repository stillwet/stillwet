"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AdminSummaryEmailFrequency } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";

export async function adminSaveSummaryEmailSettings(
  _prev: { ok: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const enabled = formData.get("enabled") === "on";
  const recipientsRaw = String(formData.get("recipients") ?? "");
  const emails = recipientsRaw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const emailSchema = z.string().email();
  for (const e of emails) {
    const r = emailSchema.safeParse(e);
    if (!r.success) {
      return { ok: false, error: `Invalid email: ${e}` };
    }
  }

  const frequencyParsed = z
    .nativeEnum(AdminSummaryEmailFrequency)
    .safeParse(String(formData.get("frequency") ?? ""));
  if (!frequencyParsed.success) {
    return { ok: false, error: "Invalid frequency." };
  }

  const hourLa = z.coerce.number().int().min(0).max(23).safeParse(formData.get("hourLa"));
  const minuteLa = z.coerce.number().int().min(0).max(59).safeParse(formData.get("minuteLa"));
  const weeklyIsoWeekday = z.coerce.number().int().min(1).max(7).safeParse(formData.get("weeklyIsoWeekday"));
  const monthlyDay = z.coerce.number().int().min(1).max(28).safeParse(formData.get("monthlyDay"));

  if (!hourLa.success || !minuteLa.success || !weeklyIsoWeekday.success || !monthlyDay.success) {
    return { ok: false, error: "Check time and schedule fields." };
  }

  await prisma.adminSummaryEmailSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled,
      recipientEmails: emails,
      frequency: frequencyParsed.data,
      hourLa: hourLa.data,
      minuteLa: minuteLa.data,
      weeklyIsoWeekday: weeklyIsoWeekday.data,
      monthlyDay: monthlyDay.data,
    },
    update: {
      enabled,
      recipientEmails: emails,
      frequency: frequencyParsed.data,
      hourLa: hourLa.data,
      minuteLa: minuteLa.data,
      weeklyIsoWeekday: weeklyIsoWeekday.data,
      monthlyDay: monthlyDay.data,
    },
  });

  revalidateAdminViews();
  return { ok: true };
}
