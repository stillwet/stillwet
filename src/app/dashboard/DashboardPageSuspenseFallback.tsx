/** Shown while dashboard body or tab data Suspense boundaries resolve (streaming RSC). */
export function DashboardPageSuspenseFallback() {
  return (
    <main className="mx-auto flex min-h-[min(420px,50vh)] max-w-[868px] flex-col justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className="inline-block h-10 w-10 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-500/90"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-300">Loading dashboard…</p>
          <p className="max-w-xs text-xs text-zinc-500">
            Fetching shop data. If this takes a while, Postgres may be waking up — check DB connectivity,
            then try refreshing.
          </p>
        </div>
      </div>
    </main>
  );
}

export function DashboardTabsSuspenseFallback() {
  return (
    <div
      className="mt-8 flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-10"
      aria-busy="true"
      aria-label="Loading tab content"
    >
      <span
        className="inline-block h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/80"
        aria-hidden
      />
      <p className="text-sm text-zinc-500">Loading tab data…</p>
    </div>
  );
}
