"use server";

import { redirect } from "next/navigation";
import { computeReportingWindow } from "@/lib/admin-summary-email-schedule";
import { computeAdminSummaryMetrics } from "@/lib/admin-summary-metrics";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";
import { sendAdminSummaryEmail } from "@/lib/send-admin-summary-email";

function parseRecipients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function adminSendSummaryEmailNow(
  _prev: { ok: boolean; error?: string } | undefined,
  _formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const settings = await prisma.adminSummaryEmailSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings) {
    return { ok: false, error: "Save digest settings first." };
  }

  const recipients = parseRecipients(settings.recipientEmails);
  if (recipients.length === 0) {
    return { ok: false, error: "Add at least one recipient and save settings." };
  }

  const now = new Date();
  const window = computeReportingWindow(settings.frequency, now);
  const metrics = await computeAdminSummaryMetrics(prisma, {
    periodStart: window.periodStartUtc,
    periodEnd: window.periodEndUtc,
    periodLabel: window.periodLabel,
  });

  const sent = await sendAdminSummaryEmail({ to: recipients, metrics });
  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  await prisma.adminSummaryEmailSettings.update({
    where: { id: "default" },
    data: {
      lastSentAt: now,
      lastSentPeriodKey: window.periodKey,
    },
  });

  revalidateAdminViews();
  return { ok: true };
}
