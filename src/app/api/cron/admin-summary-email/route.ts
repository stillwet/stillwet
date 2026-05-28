import { NextResponse } from "next/server";
// Admin digest: vercel.json schedules several daily UTC crons for this path (Hobby: ≤1/day each).
// Gating uses inScheduledSendWindow + lastSentPeriodKey so at most one send per reporting period.
import {
  computeReportingWindow,
  inScheduledSendWindow,
  matchesFrequencySchedule,
} from "@/lib/admin-summary-email-schedule";
import { adminSummaryTotalNew, computeAdminSummaryMetrics } from "@/lib/admin-summary-metrics";
import { prisma } from "@/lib/prisma";
import { sendAdminSummaryEmail } from "@/lib/send-admin-summary-email";

function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

function parseRecipients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !isVercelCron(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (process.env.ADMIN_SUMMARY_CRON_ENABLED !== "1") {
    return NextResponse.json({ ok: true, skipped: "disabled_by_env" });
  }

  const now = new Date();
  const settings = await prisma.adminSummaryEmailSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.enabled) {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  const recipients = parseRecipients(settings.recipientEmails);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_recipients" });
  }

  const freq = settings.frequency;
  if (!inScheduledSendWindow(now, settings.hourLa, settings.minuteLa)) {
    return NextResponse.json({ ok: true, skipped: "outside_send_window" });
  }

  if (!matchesFrequencySchedule(freq, now, settings.weeklyIsoWeekday, settings.monthlyDay)) {
    return NextResponse.json({ ok: true, skipped: "frequency_day_mismatch" });
  }

  const window = computeReportingWindow(freq, now);
  if (settings.lastSentPeriodKey === window.periodKey) {
    return NextResponse.json({ ok: true, skipped: "already_sent", periodKey: window.periodKey });
  }

  const metrics = await computeAdminSummaryMetrics(prisma, {
    periodStart: window.periodStartUtc,
    periodEnd: window.periodEndUtc,
    periodLabel: window.periodLabel,
  });

  const totalNew = adminSummaryTotalNew(metrics);
  if (totalNew === 0) {
    return NextResponse.json({
      ok: true,
      skipped: "all_zero",
      periodKey: window.periodKey,
    });
  }

  const sent = await sendAdminSummaryEmail({ to: recipients, metrics });
  if (!sent.ok) {
    console.error("[cron/admin-summary-email]", sent.error);
    return NextResponse.json({ ok: false, error: sent.error }, { status: 500 });
  }

  await prisma.adminSummaryEmailSettings.update({
    where: { id: "default" },
    data: {
      lastSentAt: now,
      lastSentPeriodKey: window.periodKey,
    },
  });

  return NextResponse.json({
    ok: true,
    sent: true,
    periodKey: window.periodKey,
    recipients: recipients.length,
  });
}
