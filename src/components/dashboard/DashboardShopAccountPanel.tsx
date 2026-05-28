"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  updateShopOwnerEmail,
  updateShopOwnerPassword,
  updateShopOwnerTwoFactorEmailEnabled,
  type DashboardShopAccountResult,
} from "@/actions/dashboard-shop-account";

type Props = {
  initialEmail: string;
  emailVerified: boolean;
  twoFactorEmailEnabled: boolean;
};

export function DashboardShopAccountPanel({ initialEmail, emailVerified, twoFactorEmailEnabled }: Props) {
  const router = useRouter();
  const [displayEmail, setDisplayEmail] = useState(initialEmail);
  useEffect(() => {
    setDisplayEmail(initialEmail);
  }, [initialEmail]);
  const [emailResult, setEmailResult] = useState<DashboardShopAccountResult | null>(null);
  const [passwordResult, setPasswordResult] = useState<DashboardShopAccountResult | null>(null);
  const [twoFactorResult, setTwoFactorResult] = useState<DashboardShopAccountResult | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);

  return (
    <div className="space-y-10">
      <div className="max-w-md rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Two-factor authentication
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          If enabled, signing in from a new device will require confirming via an automated email link.
        </p>
        <form
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setTwoFactorResult(null);
            setTwoFactorPending(true);
            try {
              const fd = new FormData(e.currentTarget);
              const r = await updateShopOwnerTwoFactorEmailEnabled(undefined, fd);
              setTwoFactorResult(r);
              if ("ok" in r && r.ok) router.refresh();
            } finally {
              setTwoFactorPending(false);
            }
          }}
        >
          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <span>2-factor (email on new device)</span>
            <span className="relative inline-flex items-center">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={twoFactorEmailEnabled}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="h-6 w-11 rounded-full border border-zinc-700 bg-zinc-900 transition-colors peer-checked:border-emerald-800 peer-checked:bg-emerald-900/60 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500/60"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-zinc-200 shadow-sm transition-transform peer-checked:translate-x-5"
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={twoFactorPending}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            {twoFactorPending ? "Saving…" : "Save"}
          </button>
        </form>
        {twoFactorResult ? (
          "ok" in twoFactorResult && twoFactorResult.ok ? (
            <p className="mt-3 text-xs text-emerald-300/90" role="status">
              {twoFactorResult.message}
            </p>
          ) : (
            <p className="mt-3 text-xs text-amber-300/90" role="alert">
              {"error" in twoFactorResult ? twoFactorResult.error : "Something went wrong."}
            </p>
          )
        ) : null}
      </div>
      <div className="max-w-md">
        <div className="block text-sm text-zinc-400">
          Current Email
          <div className="mt-1 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
            <span className="min-w-0 break-all">{displayEmail}</span>
            {emailVerified ? (
              <span className="shrink-0 text-xs font-normal text-emerald-400/90">Verified</span>
            ) : (
              <span className="shrink-0 text-xs font-normal text-amber-400/90">Not verified</span>
            )}
          </div>
        </div>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setEmailResult(null);
            setEmailPending(true);
            try {
              const fd = new FormData(e.currentTarget);
              const r = await updateShopOwnerEmail(undefined, fd);
              setEmailResult(r);
              if ("ok" in r && r.ok) {
                const next = String(fd.get("newEmail") ?? "").trim().toLowerCase();
                if (next) setDisplayEmail(next);
                (e.currentTarget as HTMLFormElement).reset();
                router.refresh();
              }
            } finally {
              setEmailPending(false);
            }
          }}
        >
          <label className="block text-sm text-zinc-400">
            New email
            <input
              type="email"
              name="newEmail"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Current password
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          {emailResult && "error" in emailResult ? (
            <p className="text-sm text-amber-400" role="alert">
              {emailResult.error}
            </p>
          ) : null}
          {emailResult && "ok" in emailResult && emailResult.ok ? (
            <p className="text-sm text-emerald-400/90" role="status">
              {emailResult.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={emailPending}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 disabled:opacity-50"
          >
            {emailPending ? "Saving…" : "Update email"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Password</h2>
        <form
          className="mt-4 max-w-md space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPasswordResult(null);
            setPasswordPending(true);
            try {
              const fd = new FormData(e.currentTarget);
              const r = await updateShopOwnerPassword(undefined, fd);
              setPasswordResult(r);
              if ("ok" in r && r.ok) {
                (e.currentTarget as HTMLFormElement).reset();
                router.refresh();
              }
            } finally {
              setPasswordPending(false);
            }
          }}
        >
          <label className="block text-sm text-zinc-400">
            Current password
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            New password
            <input
              type="password"
              name="newPassword"
              required
              minLength={10}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Confirm new password
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={10}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          {passwordResult && "error" in passwordResult ? (
            <p className="text-sm text-amber-400" role="alert">
              {passwordResult.error}
            </p>
          ) : null}
          {passwordResult && "ok" in passwordResult && passwordResult.ok ? (
            <p className="text-sm text-emerald-400/90" role="status">
              {passwordResult.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 disabled:opacity-50"
          >
            {passwordPending ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
