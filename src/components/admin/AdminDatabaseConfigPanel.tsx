import Link from "next/link";
import { logoutAdmin } from "@/actions/admin";

type Props = {
  localhostEnvKeys: string[];
};

export function AdminDatabaseConfigPanel({ localhostEnvKeys }: Props) {
  return (
    <div className="mx-auto max-w-[720px] space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-100">Admin — database not configured</h1>
        <form action={logoutAdmin}>
          <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-300">
            Log out
          </button>
        </form>
      </div>

      <div
        role="alert"
        className="rounded-xl border border-amber-900/50 bg-amber-950/25 px-4 py-5 text-sm text-amber-100/90"
      >
        <p className="font-medium text-amber-50/95">Production has no Postgres connection</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-200/85">
          This deployment cannot reach a database. Admin tabs load data from Neon — until{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-[11px]">
            /api/health
          </code>{" "}
          shows <code className="font-mono text-[11px]">database.ok: true</code>, every admin page
          will fail.
        </p>
        {localhostEnvKeys.length > 0 ? (
          <p className="mt-3 text-xs text-amber-200/80">
            Ignored localhost env on Vercel:{" "}
            <code className="font-mono text-[11px]">{localhostEnvKeys.join(", ")}</code> — remove
            these from Production or replace with Neon URLs.
          </p>
        ) : null}
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-amber-200/85">
          <li>
            Vercel → project for <strong className="font-medium">stillwet.com</strong> →{" "}
            <strong className="font-medium">Storage → Connect Neon</strong> (or add{" "}
            <code className="font-mono text-[11px]">POSTGRES_PRISMA_URL</code> manually under
            Production env).
          </li>
          <li>
            Delete any Production <code className="font-mono text-[11px]">DATABASE_URL</code> /
            <code className="font-mono text-[11px]"> DIRECT_URL</code> pointing at{" "}
            <code className="font-mono text-[11px]">127.0.0.1</code>.
          </li>
          <li>Redeploy Production.</li>
          <li>
            From your laptop (after{" "}
            <code className="font-mono text-[11px]">vercel env pull</code>):{" "}
            <code className="font-mono text-[11px]">npm run db:migrate:prod</code>
          </li>
        </ol>
      </div>

      <p className="text-xs text-zinc-500">
        Check status:{" "}
        <Link href="/api/health" className="text-blue-400/90 hover:underline" target="_blank">
          /api/health
        </Link>
        {" · "}
        <Link href="/admin" className="text-blue-400/90 hover:underline">
          Admin Dash
        </Link>
      </p>
    </div>
  );
}
