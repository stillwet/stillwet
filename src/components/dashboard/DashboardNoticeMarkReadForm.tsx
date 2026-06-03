"use client";

import { useTransition } from "react";
import { dashboardMarkOwnerNoticeRead } from "@/actions/shop-dashboard-notices";

export function DashboardNoticeMarkReadForm(props: {
  noticeId: string;
  onMarkedRead?: () => void | Promise<void>;
}) {
  const { noticeId, onMarkedRead } = props;
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="shrink-0"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.set("noticeId", noticeId);
        startTransition(async () => {
          await dashboardMarkOwnerNoticeRead(formData);
          await onMarkedRead?.();
        });
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Marking…" : "Mark as read"}
      </button>
    </form>
  );
}
