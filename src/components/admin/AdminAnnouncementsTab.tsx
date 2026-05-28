"use client";

import { useActionState, useEffect, useState } from "react";
import { adminSendShopAnnouncement } from "@/actions/admin-announcements";
import { DashboardNoticeBody } from "@/components/dashboard/DashboardNoticeBody";
import { ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS } from "@/lib/admin-announcements";
import { useRouter } from "next/navigation";

export function AdminAnnouncementsTab() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState(adminSendShopAnnouncement, undefined);
  const charsRemaining = ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS - body.length;

  useEffect(() => {
    if (state?.ok) {
      setBody("");
      router.refresh();
    }
  }, [state, router]);

  return (
    <section id="announcements" aria-label="Shop announcements" className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Shop announcements
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600">
          Send an unread notification to every active creator shop. Paused, inactive, deleting,
          and platform catalog shops are skipped. Supports plain URLs and{" "}
          <code className="text-zinc-400">[label](https://...)</code> links.
        </p>
      </div>

      {state?.ok ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Announcement sent to {state.sentCount} {state.sentCount === 1 ? "shop" : "shops"}.
        </p>
      ) : state ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/35 px-3 py-2 text-sm text-rose-100/95"
        >
          {state.error}
        </p>
      ) : null}

      <form action={action} className="max-w-3xl space-y-4">
        <label className="block text-xs text-zinc-500">
          Announcement message
          <textarea
            name="body"
            required
            rows={7}
            maxLength={ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-100"
            placeholder="Example: New promotion slots are open. Read details: https://..."
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={charsRemaining < 0 ? "text-xs text-rose-300" : "text-xs text-zinc-600"}>
            {charsRemaining.toLocaleString()} characters remaining.
          </p>
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-2 text-sm font-medium text-blue-200/95 hover:bg-blue-950/45 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send announcement"}
          </button>
        </div>
      </form>

      <div className="max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Notification preview
        </h3>
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm leading-relaxed text-zinc-300">
          {body.trim() ? (
            <DashboardNoticeBody body={body} />
          ) : (
            <span className="text-zinc-600">Your announcement preview will appear here.</span>
          )}
        </div>
      </div>
    </section>
  );
}
