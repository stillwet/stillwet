"use client";

import { useTransition } from "react";
import { dashboardMarkAllOwnerNoticesRead } from "@/actions/shop-dashboard-notices";

export function DashboardMarkAllNoticesReadButton(props: {
  unreadCount: number;
  onMarkedAllRead?: () => void | Promise<void>;
}) {
  const { unreadCount, onMarkedAllRead } = props;
  const [pending, startTransition] = useTransition();

  if (unreadCount <= 0) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await dashboardMarkAllOwnerNoticesRead();
          await onMarkedAllRead?.();
        });
      }}
      className="shrink-0 rounded-md border border-zinc-700/80 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300 shadow-sm transition hover:border-sky-800/55 hover:bg-sky-950/30 hover:text-sky-100/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Marking…" : "Mark all as read"}
    </button>
  );
}
