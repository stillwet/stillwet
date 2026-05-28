import type { AdminSummaryEmailSettings } from "@/generated/prisma/client";
import { AdminSummaryEmailFrequency } from "@/generated/prisma/enums";

export type AdminSummaryEmailSettingsDTO = {
  enabled: boolean;
  recipientEmails: string[];
  frequency: (typeof AdminSummaryEmailFrequency)[keyof typeof AdminSummaryEmailFrequency];
  hourLa: number;
  minuteLa: number;
  weeklyIsoWeekday: number;
  monthlyDay: number;
  lastSentAt: string | null;
  lastSentPeriodKey: string | null;
};

export const DEFAULT_ADMIN_SUMMARY_EMAIL_DTO: AdminSummaryEmailSettingsDTO = {
  enabled: false,
  recipientEmails: [],
  frequency: AdminSummaryEmailFrequency.daily,
  hourLa: 16,
  minuteLa: 0,
  weeklyIsoWeekday: 1,
  monthlyDay: 1,
  lastSentAt: null,
  lastSentPeriodKey: null,
};

export function toAdminSummaryEmailSettingsDTO(row: AdminSummaryEmailSettings): AdminSummaryEmailSettingsDTO {
  const raw = row.recipientEmails;
  const recipientEmails = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    enabled: row.enabled,
    recipientEmails,
    frequency: row.frequency,
    hourLa: row.hourLa,
    minuteLa: row.minuteLa,
    weeklyIsoWeekday: row.weeklyIsoWeekday,
    monthlyDay: row.monthlyDay,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    lastSentPeriodKey: row.lastSentPeriodKey,
  };
}
