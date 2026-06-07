"use client";

import { useActionState } from "react";
import {
  adminPullVercelProductionEnvAction,
  type AdminPullVercelProductionEnvResult,
} from "@/actions/admin-pull-vercel-env";

export function AdminPullVercelProductionEnvButton({
  vercelLinked,
}: {
  vercelLinked: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    AdminPullVercelProductionEnvResult | null,
    FormData
  >(adminPullVercelProductionEnvAction, null);

  const btnClass =
    "rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-xs font-medium text-zinc-500 hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        Pull prod env
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Runs{" "}
          <code className="font-mono text-zinc-400">vercel env pull</code> (production) and copies
          into <code className="font-mono text-zinc-400">.env</code>. Local dev only — requires{" "}
          <code className="font-mono text-zinc-400">vercel login</code> and{" "}
          <code className="font-mono text-zinc-400">vercel link</code>.
        </p>
        {!vercelLinked ? (
          <p className="mt-2 text-[11px] text-amber-200/90">
            No <code className="font-mono">.vercel/project.json</code> — link the repo first.
          </p>
        ) : null}
        <form action={formAction} className="mt-3">
          <button type="submit" disabled={pending || !vercelLinked} className={btnClass}>
            {pending ? "Pulling…" : "Pull & update .env"}
          </button>
        </form>
        {state?.ok ? (
          <p className="mt-2 text-[11px] text-emerald-300/90" role="status">
            {state.message}
          </p>
        ) : null}
        {state && !state.ok ? (
          <p className="mt-2 text-[11px] text-red-300/90" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
