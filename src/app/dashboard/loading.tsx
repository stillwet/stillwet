import { DASHBOARD_LOADING_SHELL_CLASS } from "@/lib/dashboard-layout";

export default function DashboardLoading() {
  return (
    <main className={DASHBOARD_LOADING_SHELL_CLASS}>
      <div className="flex items-center gap-3 text-sm text-zinc-400">
        <span
          className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-500/90"
          aria-hidden
        />
        Loading dashboard…
      </div>
    </main>
  );
}
