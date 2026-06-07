"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  updateShopOwnerEmail,
  updateShopOwnerPassword,
  updateShopOwnerTwoFactorEmailEnabled,
  type DashboardShopAccountResult,
} from "@/actions/dashboard-shop-account";
import { resendShopEmailVerification } from "@/actions/shop-email-verify";
import { ShopDangerZonePanel } from "@/components/dashboard/ShopDangerZonePanel";
import { PasswordInput } from "@/components/PasswordInput";

export type DashboardShopAccountPanelProps = {
  initialEmail: string;
  emailVerified: boolean;
  twoFactorEmailEnabled: boolean;
  accountDeletionRequestedAt: string | null;
  accountDeletionEmailConfirmedAt: string | null;
  stripeConnectAccountId: string | null;
  stripeConnectBalance: { availableCents: number; pendingCents: number } | null;
};

/** Dashboard shell passes `email`; panel expects `initialEmail`. */
export type DashboardShopAccountPayload = Omit<DashboardShopAccountPanelProps, "initialEmail"> & {
  email: string;
};

export function DashboardShopAccountPanel({
  initialEmail,
  emailVerified,
  twoFactorEmailEnabled,
  accountDeletionRequestedAt,
  accountDeletionEmailConfirmedAt,
  stripeConnectAccountId,
  stripeConnectBalance,
}: DashboardShopAccountPanelProps) {
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

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(twoFactorEmailEnabled);
  const [emailPasswordRevealed, setEmailPasswordRevealed] = useState(false);
  const [verifyResendPending, setVerifyResendPending] = useState(false);
  const [verifyResendResult, setVerifyResendResult] = useState<
    { ok: true; message: string } | { ok: false; error: string } | null
  >(null);
  const [passwordConfirmRevealed, setPasswordConfirmRevealed] = useState(false);
  const emailPasswordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const passwordCurrentRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTwoFactorEnabled(twoFactorEmailEnabled);
  }, [twoFactorEmailEnabled]);

  const btnAccountAction =
    "rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div className="max-w-md rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Two-factor authentication
          </h2>
          <div className="flex items-center gap-2">
            <label
              className={`flex items-center gap-2 text-xs text-zinc-300 ${twoFactorPending ? "opacity-60" : ""}`}
            >
              <span>2FA</span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={twoFactorEnabled}
                  disabled={twoFactorPending}
                  className="peer sr-only"
                  onChange={(e) => {
                    const next = e.target.checked;
                    const prev = twoFactorEnabled;
                    setTwoFactorEnabled(next);
                    setTwoFactorResult(null);
                    setTwoFactorPending(true);
                    void (async () => {
                      try {
                        const fd = new FormData();
                        if (next) fd.set("enabled", "on");
                        const r = await updateShopOwnerTwoFactorEmailEnabled(undefined, fd);
                        if ("ok" in r && r.ok) {
                          router.refresh();
                          return;
                        }
                        setTwoFactorEnabled(prev);
                        setTwoFactorResult(r);
                      } finally {
                        setTwoFactorPending(false);
                      }
                    })();
                  }}
                />
              <span
                aria-hidden
                className="h-5 w-9 rounded-full border border-zinc-700 bg-zinc-900 transition-colors peer-checked:border-emerald-800 peer-checked:bg-emerald-900/60 peer-disabled:cursor-not-allowed peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500/60"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-zinc-200 shadow-sm transition-transform peer-checked:translate-x-4"
              />
              </span>
            </label>
            {twoFactorPending ? <span className="text-xs text-zinc-500">Saving…</span> : null}
          </div>
        </div>
        <p className="mt-0.5 text-[11px] italic leading-snug text-zinc-500">
          If enabled, signing in from a new device will require confirming via an automated email link.
        </p>
        {twoFactorResult && "error" in twoFactorResult ? (
          <p className="mt-2 text-xs text-amber-300/90" role="alert">
            {twoFactorResult.error}
          </p>
        ) : null}
      </div>
      <div className="max-w-md">
        <div className="block text-xs text-zinc-400">
          Current Email
          <div className="mt-0.5 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100">
            <span className="min-w-0 break-all">{displayEmail}</span>
            {emailVerified ? (
              <span className="shrink-0 text-[11px] font-normal text-emerald-400/90">Verified</span>
            ) : (
              <span className="shrink-0 text-[11px] font-normal text-zinc-100">Not verified</span>
            )}
          </div>
          {!emailVerified ? (
            <div className="mt-1.5">
              <button
                type="button"
                disabled={verifyResendPending}
                className="rounded-lg border border-blue-900/60 bg-blue-950/30 px-3 py-1 text-xs font-medium text-blue-200 hover:border-blue-700/60 hover:bg-blue-950/50 disabled:opacity-50"
                onClick={() => {
                  setVerifyResendResult(null);
                  setVerifyResendPending(true);
                  void (async () => {
                    try {
                      const r = await resendShopEmailVerification();
                      setVerifyResendResult(r);
                    } finally {
                      setVerifyResendPending(false);
                    }
                  })();
                }}
              >
                {verifyResendPending ? "Sending…" : "Resend email verification"}
              </button>
              {verifyResendResult ? (
                "ok" in verifyResendResult && verifyResendResult.ok ? (
                  <p className="mt-1.5 text-xs text-emerald-400/90" role="status">
                    {verifyResendResult.message}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-amber-400" role="alert">
                    {verifyResendResult.error}
                  </p>
                )
              ) : null}
            </div>
          ) : null}
        </div>
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setEmailResult(null);
            const fd = new FormData(e.currentTarget);
            const newEmail = String(fd.get("newEmail") ?? "").trim();
            if (!newEmail) return;

            if (!emailPasswordRevealed) {
              setEmailPasswordRevealed(true);
              requestAnimationFrame(() => emailPasswordRef.current?.focus());
              return;
            }

            setEmailPending(true);
            try {
              const r = await updateShopOwnerEmail(undefined, fd);
              setEmailResult(r);
              if ("ok" in r && r.ok) {
                setDisplayEmail(newEmail.toLowerCase());
                setEmailPasswordRevealed(false);
                (e.currentTarget as HTMLFormElement).reset();
                router.refresh();
              }
            } finally {
              setEmailPending(false);
            }
          }}
        >
          <label className="block text-xs text-zinc-400">
            New email
            <input
              type="email"
              name="newEmail"
              required
              autoComplete="email"
              className="mt-0.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
              onChange={(e) => {
                if (!e.target.value.trim()) setEmailPasswordRevealed(false);
              }}
            />
          </label>
          {emailPasswordRevealed ? (
            <label className="block text-xs text-zinc-400">
              Verify email change by entering current password
              <PasswordInput
                ref={emailPasswordRef}
                name="currentPassword"
                required
                autoComplete="current-password"
                wrapperClassName="mt-0.5"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
              />
            </label>
          ) : null}
          {emailResult && "error" in emailResult ? (
            <p className="text-xs text-amber-400" role="alert">
              {emailResult.error}
            </p>
          ) : null}
          {emailResult && "ok" in emailResult && emailResult.ok ? (
            <p className="text-xs text-emerald-400/90" role="status">
              {emailResult.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={emailPending}
            className={btnAccountAction}
          >
            {emailPending ? "Saving…" : "Update email"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Password</h2>
        <form
          className="mt-2 max-w-md space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setPasswordResult(null);
            const fd = new FormData(e.currentTarget);
            const newPassword = String(fd.get("newPassword") ?? "");
            if (newPassword.length < 10) return;

            if (!passwordConfirmRevealed) {
              setPasswordConfirmRevealed(true);
              requestAnimationFrame(() => passwordConfirmRef.current?.focus());
              return;
            }

            setPasswordPending(true);
            try {
              const r = await updateShopOwnerPassword(undefined, fd);
              setPasswordResult(r);
              if ("ok" in r && r.ok) {
                setPasswordConfirmRevealed(false);
                (e.currentTarget as HTMLFormElement).reset();
                router.refresh();
              }
            } finally {
              setPasswordPending(false);
            }
          }}
        >
          <label className="block text-xs text-zinc-400">
            New password
            <PasswordInput
              name="newPassword"
              required
              minLength={10}
              autoComplete="new-password"
              wrapperClassName="mt-0.5"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
              onChange={(e) => {
                if (!e.target.value) setPasswordConfirmRevealed(false);
              }}
            />
          </label>
          {passwordConfirmRevealed ? (
            <>
              <label className="block text-xs text-zinc-400">
                Confirm new password
                <PasswordInput
                  ref={passwordConfirmRef}
                  name="confirmPassword"
                  required
                  minLength={10}
                  autoComplete="new-password"
                  wrapperClassName="mt-0.5"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Verify this change by entering your current password
                <PasswordInput
                  ref={passwordCurrentRef}
                  name="currentPassword"
                  required
                  autoComplete="current-password"
                  wrapperClassName="mt-0.5"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
                />
              </label>
            </>
          ) : null}
          {passwordResult && "error" in passwordResult ? (
            <p className="text-xs text-amber-400" role="alert">
              {passwordResult.error}
            </p>
          ) : null}
          {passwordResult && "ok" in passwordResult && passwordResult.ok ? (
            <p className="text-xs text-emerald-400/90" role="status">
              {passwordResult.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={passwordPending}
            className={btnAccountAction}
          >
            {passwordPending ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>

      <div className="max-w-md border-t border-zinc-800 pt-4">
        <ShopDangerZonePanel
          accountDeletionRequestedAt={accountDeletionRequestedAt}
          accountDeletionEmailConfirmedAt={accountDeletionEmailConfirmedAt}
          stripeConnectAccountId={stripeConnectAccountId}
          stripeConnectBalance={stripeConnectBalance}
        />
      </div>
    </div>
  );
}
