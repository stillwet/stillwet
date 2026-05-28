"use client";

import { useActionState, useEffect } from "react";
import { adminSaveSummaryEmailSettings } from "@/actions/admin-summary-email-settings";
import { adminSendSummaryEmailNow } from "@/actions/admin-summary-email-send-now";
import type { AdminSummaryEmailSettingsDTO } from "@/lib/admin-summary-email-settings-dto";
import { AdminSummaryEmailFrequency } from "@/generated/prisma/enums";
import { ADMIN_SUMMARY_TIMEZONE } from "@/lib/admin-summary-email-schedule";
import { useRouter } from "next/navigation";

const ISO_WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

export function AdminSummaryEmailPanel(props: { initial: AdminSummaryEmailSettingsDTO }) {
  const router = useRouter();
  const { initial } = props;

  const [saveState, saveAction, savePending] = useActionState(adminSaveSummaryEmailSettings, undefined);
  const [sendState, sendAction, sendPending] = useActionState(adminSendSummaryEmailNow, undefined);

  useEffect(() => {
    if (saveState?.ok) {
      router.refresh();
    }
  }, [saveState, router]);

  useEffect(() => {
    if (sendState?.ok) {
      router.refresh();
    }
  }, [sendState, router]);

  return (
    <section aria-label="Admin digest email" className="mb-10 space-y-4 border-b border-zinc-800 pb-10">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Admin digest email</h2>
      </div>

      {saveState && !saveState.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/35 px-3 py-2 text-sm text-rose-100/95"
        >
          {saveState.error}
        </p>
      ) : null}
      {saveState?.ok ? (
        <p role="status" className="text-sm text-emerald-200/90">
          Digest settings saved.
        </p>
      ) : null}
      {sendState && !sendState.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/35 px-3 py-2 text-sm text-rose-100/95"
        >
          {sendState.error}
        </p>
      ) : null}
      {sendState?.ok ? (
        <p role="status" className="text-sm text-emerald-200/90">
          Summary email sent.
        </p>
      ) : null}

      <form action={saveAction} className="max-w-xl space-y-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
          <input type="checkbox" name="enabled" value="on" defaultChecked={initial.enabled} className="rounded" />
          Enable automated digest
        </label>

        <label className="block text-xs text-zinc-500">
          Recipients (one email per line)
          <textarea
            name="recipients"
            rows={4}
            spellCheck={false}
            defaultValue={initial.recipientEmails.join("\n")}
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-[13px] text-zinc-100"
            placeholder="you@domain.com"
          />
        </label>

        <label className="block text-xs text-zinc-500">
          How often
          <select
            name="frequency"
            defaultValue={initial.frequency}
            className="mt-1 block w-full max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          >
            <option value={AdminSummaryEmailFrequency.daily}>Daily</option>
            <option value={AdminSummaryEmailFrequency.weekly}>Weekly</option>
            <option value={AdminSummaryEmailFrequency.monthly}>Monthly</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="block text-xs text-zinc-500">
            Local hour (0–23)
            <input
              type="number"
              name="hourLa"
              min={0}
              max={23}
              defaultValue={initial.hourLa}
              className="mt-1 block w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Local minute (0–59)
            <input
              type="number"
              name="minuteLa"
              min={0}
              max={59}
              defaultValue={initial.minuteLa}
              className="mt-1 block w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>
        </div>
        <p className="text-[11px] leading-snug text-zinc-600">
          Automated sends use a few daily Vercel cron windows (Hobby plan: at most once per schedule per
          day). After this clock on eligible days, the next cron may deliver the digest; exact minute
          can vary within the hour.
        </p>

        <label className="block text-xs text-zinc-500">
          Weekly send day (ISO weekday; used when frequency is weekly)
          <select
            name="weeklyIsoWeekday"
            defaultValue={initial.weeklyIsoWeekday}
            className="mt-1 block w-full max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          >
            {ISO_WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-zinc-500">
          Monthly send day (1–28; used when frequency is monthly; if the month is shorter, we send on the last day)
          <input
            type="number"
            name="monthlyDay"
            min={1}
            max={28}
            defaultValue={initial.monthlyDay}
            className="mt-1 block w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>

        <button
          type="submit"
          disabled={savePending}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {savePending ? "Saving…" : "Save digest settings"}
        </button>
      </form>

      <form action={sendAction} className="max-w-xl">
        <p className="mb-2 text-xs text-zinc-600">
          Uses saved recipients and the same reporting window as the automated digest ({ADMIN_SUMMARY_TIMEZONE}{" "}
          boundaries for your current frequency). Requires Resend to be configured.
        </p>
        <button
          type="submit"
          disabled={sendPending || savePending}
          className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-2 text-sm font-medium text-blue-200/95 hover:bg-blue-950/45 disabled:opacity-50"
        >
          {sendPending ? "Sending…" : "Manually send summary now"}
        </button>
      </form>

      <div className="text-[11px] text-zinc-600">
        <p>
          Last sent:{" "}
          {initial.lastSentAt ? (
            <time dateTime={initial.lastSentAt}>{new Date(initial.lastSentAt).toLocaleString()}</time>
          ) : (
            "never"
          )}
        </p>
        {initial.lastSentPeriodKey ? (
          <p className="mt-0.5">
            Last period key: <code className="text-zinc-400">{initial.lastSentPeriodKey}</code>
          </p>
        ) : null}
      </div>
    </section>
  );
}
