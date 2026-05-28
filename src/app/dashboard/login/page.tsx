"use client";

import { useState } from "react";
import Link from "next/link";
import { loginShopOwner } from "@/actions/shop-auth";

export default function DashboardLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [reactivationUrl, setReactivationUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Shop dashboard login</h1>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setReactivationUrl(null);
          setPending(true);
          try {
            const fd = new FormData(e.currentTarget);
            const r = await loginShopOwner(undefined, fd);
            if (r?.error) setError(r.error);
            if (r?.redirectTo) setReactivationUrl(r.redirectTo);
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-sm text-zinc-400">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        {error ? (
          <p className="text-sm text-amber-400" role="alert">
            {error}
          </p>
        ) : null}
        {reactivationUrl ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-medium">This shop is deactivated for inactivity.</p>
            <p className="mt-2 text-amber-100/80">
              Pay the one-time $5 reactivation fee to restore dashboard access.
            </p>
            <a
              href={reactivationUrl}
              className="mt-3 inline-flex rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-white"
            >
              Pay $5 reactivation fee
            </a>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {pending ? "…" : "Sign in"}
        </button>
        <p className="text-center text-sm">
          <Link href="/dashboard/forgot-password" className="text-blue-400 hover:underline">
            Forgot password?
          </Link>
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        New here?{" "}
        <Link href="/create-shop" className="text-blue-400 hover:underline">
          Create Shop
        </Link>
      </p>
      <Link href="/" className="mt-8 text-center text-xs text-zinc-600 hover:underline">
        ← Home
      </Link>
    </main>
  );
}
