"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard route]", error);
  }, [error]);

  const msg = error.message ?? String(error);
  const looksLikeStaleClient =
    /Unknown argument `/i.test(msg) ||
    /Cannot read properties of undefined \(reading 'count'\)/i.test(msg) ||
    /moderationKeyword/i.test(msg);
  const looksLikeUploadOrAction =
    /body exceeded|1\s*mb limit|unexpected response was received from the server/i.test(msg);
  const looksLikeDb =
    !looksLikeStaleClient &&
    !looksLikeUploadOrAction &&
    (/does not exist|Unknown column|P20\d{2}|relation\s+"ModerationKeyword"/i.test(msg) ||
      (/invalid.*prisma.*invocation/i.test(msg) && /column|relation|migrate/i.test(msg)));

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Dashboard couldn&apos;t load</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {looksLikeStaleClient
          ? "The running app is using an outdated Prisma Client. Run `npx prisma generate`, redeploy, or restart the server so delegates like `moderationKeyword` are available."
          : looksLikeUploadOrAction
            ? "A listing upload or dashboard refresh failed (often artwork over the server size limit). Redeploy the latest build, try a smaller image (under 10 MB), or open the Listings tab after a full page reload."
            : looksLikeDb
              ? "Production Postgres may be missing a recent migration (for example `20260516120000_moderation_keyword` or `listingFeeBonusFreeSlots` on Shop). Apply pending migrations, then redeploy."
              : "Something went wrong while loading the shop dashboard. Check Vercel → Logs for the stack trace."}
      </p>
      {looksLikeDb ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          From the repo:{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300">
            npm run db:migrate:prod
          </code>{" "}
          (after{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300">
            vercel env pull
          </code>
          ). See <code className="text-zinc-300">VERCEL.md</code> § Database schema.
        </p>
      ) : null}
      <pre className="mt-4 max-h-48 overflow-auto rounded border border-zinc-800 bg-zinc-950/80 p-3 text-left font-mono text-[11px] text-zinc-400">
        {msg}
      </pre>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Try again
        </button>
        <Link
          href="/dashboard/login"
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Dashboard login
        </Link>
      </div>
    </main>
  );
}
