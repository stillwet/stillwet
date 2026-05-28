import { TZDate } from "@date-fns/tz";
import {
  endOfMonth,
  format,
  getISODay,
  getISOWeek,
  getISOWeekYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type { AdminSummaryEmailFrequency } from "@/generated/prisma/enums";

export const ADMIN_SUMMARY_TIMEZONE = "America/Los_Angeles" as const;

export type AdminSummaryReportingWindow = {
  periodStartUtc: Date;
  periodEndUtc: Date;
  periodKey: string;
  periodLabel: string;
};

function laNow(nowUtc: Date = new Date()): TZDate {
  return new TZDate(nowUtc.getTime(), ADMIN_SUMMARY_TIMEZONE);
}

/**
 * Whether the digest may send at `nowUtc` for the configured LA clock time.
 *
 * Vercel **Hobby** allows each cron expression at most **once per day** (and timing can fall anywhere
 * within the scheduled UTC hour). The app uses several daily UTC crons (see `vercel.json`) that
 * hit the same route; we treat the send window as **the rest of the LA calendar day on or after**
 * `hourLa:minuteLa`, so the first post-target invocation can deliver. Duplicate sends are still
 * prevented by `lastSentPeriodKey` in the cron handler.
 */
export function inScheduledSendWindow(
  nowUtc: Date,
  hourLa: number,
  minuteLa: number,
): boolean {
  const z = laNow(nowUtc);
  const minutesSinceMidnight = z.getHours() * 60 + z.getMinutes();
  const target = hourLa * 60 + minuteLa;
  return minutesSinceMidnight >= target;
}

export function matchesFrequencySchedule(
  frequency: AdminSummaryEmailFrequency,
  nowUtc: Date,
  weeklyIsoWeekday: number,
  monthlyDay: number,
): boolean {
  const z = laNow(nowUtc);
  if (frequency === "daily") return true;
  if (frequency === "weekly") return getISODay(z) === weeklyIsoWeekday;
  const day = z.getDate();
  if (day === monthlyDay) return true;
  /** If configured day exceeds month length (e.g. 31 in Feb), send on last day. */
  const lastDay = endOfMonth(z).getDate();
  return monthlyDay > lastDay && day === lastDay;
}

function toUtcInstant(d: Date): Date {
  return new Date(d.getTime());
}

/**
 * Half-open reporting window [periodStartUtc, periodEndUtc) in UTC instant terms,
 * aligned to `America/Los_Angeles` calendar boundaries.
 */
export function computeReportingWindow(
  frequency: AdminSummaryEmailFrequency,
  nowUtc: Date,
): AdminSummaryReportingWindow {
  const z = laNow(nowUtc);
  const mmddyy = (d: Date) => format(d, "MM/dd/yy");

  if (frequency === "daily") {
    const todayStart = startOfDay(z);
    const yesterdayStart = startOfDay(subDays(z, 1));
    const dayStr = format(yesterdayStart, "yyyy-MM-dd");
    return {
      periodStartUtc: toUtcInstant(yesterdayStart),
      periodEndUtc: toUtcInstant(todayStart),
      periodKey: `${dayStr}-daily`,
      periodLabel: mmddyy(yesterdayStart),
    };
  }

  if (frequency === "weekly") {
    const thisMonday = startOfWeek(z, { weekStartsOn: 1 });
    const lastMonday = subWeeks(thisMonday, 1);
    const isoY = getISOWeekYear(lastMonday);
    const isoW = getISOWeek(lastMonday);
    const lastSunday = subDays(thisMonday, 1);
    return {
      periodStartUtc: toUtcInstant(startOfDay(lastMonday)),
      periodEndUtc: toUtcInstant(startOfDay(thisMonday)),
      periodKey: `${isoY}-W${String(isoW).padStart(2, "0")}-weekly`,
      periodLabel: `${mmddyy(lastMonday)}–${mmddyy(lastSunday)}`,
    };
  }

  const thisMonthStart = startOfMonth(z);
  const prevMonthStart = startOfMonth(subMonths(z, 1));
  const monthStr = format(prevMonthStart, "yyyy-MM");
  const prevMonthEnd = subDays(thisMonthStart, 1);
  return {
    periodStartUtc: toUtcInstant(prevMonthStart),
    periodEndUtc: toUtcInstant(thisMonthStart),
    periodKey: `${monthStr}-monthly`,
    periodLabel: `${mmddyy(prevMonthStart)}–${mmddyy(prevMonthEnd)}`,
  };
}
