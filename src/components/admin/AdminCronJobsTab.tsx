import type { CronJobReferenceRow } from "@/lib/cron-jobs-reference";

function statusClass(status: CronJobReferenceRow["status"]) {
  switch (status) {
    case "scheduled":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "manual":
      return "border-blue-500/30 bg-blue-500/10 text-blue-200";
    case "disabled":
      return "border-zinc-700 bg-zinc-900/80 text-zinc-400";
  }
}

export function AdminCronJobsTab({ rows }: { rows: CronJobReferenceRow[] }) {
  return (
    <section className="space-y-4" aria-label="Cron jobs">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Cron jobs</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Scheduled jobs are grouped by recurrence to reduce database wakeups. Times are UTC.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.7fr_1.4fr] gap-4 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          <span>Name</span>
          <span>Path</span>
          <span>Schedule</span>
          <span>Status</span>
          <span>Notes</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.path}
            className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.7fr_1.4fr] gap-4 border-b border-zinc-900 px-4 py-4 text-sm last:border-b-0"
          >
            <div>
              <p className="font-medium text-zinc-200">{row.name}</p>
              <p className="mt-1 text-xs text-zinc-600">{row.frequency}</p>
            </div>
            <code className="break-all text-xs text-zinc-400">{row.path}</code>
            <code className="text-xs text-zinc-400">{row.schedule}</code>
            <span
              className={`inline-flex h-7 w-fit items-center rounded-full border px-2.5 text-[11px] font-medium uppercase tracking-wide ${statusClass(
                row.status,
              )}`}
            >
              {row.status}
            </span>
            <p className="text-sm leading-relaxed text-zinc-500">{row.notes}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
