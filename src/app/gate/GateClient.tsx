"use client";

import { useState } from "react";
import { StillWetLogo } from "@/components/StillWetLogo";
import { FormFieldValidationBubble, FormValidationAlert } from "@/components/FormFieldValidationBubble";
import { PasswordInput } from "@/components/PasswordInput";
import { requiredFieldError } from "@/lib/form-field-validation";

function safeRedirectPath(from: string | null): string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) {
    return "/";
  }
  return from;
}

export function GateClient({ redirectFrom }: { redirectFrom: string | null }) {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Hide password UI once auth succeeded; avoids a flash of the form while the document navigates. */
  const [leaving, setLeaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = requiredFieldError(password, "the password");
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    setPasswordError(null);
    setPending(true);
    let success = false;
    try {
      const res = await fetch("/api/site-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not sign in");
        return;
      }
      success = true;
      setLeaving(true);
      const target = safeRedirectPath(redirectFrom);
      const absolute = new URL(target, window.location.origin).href;
      // Defer so the browser can apply Set-Cookie from the fetch response before the next document load.
      window.setTimeout(() => {
        window.location.replace(absolute);
      }, 0);
    } catch {
      setError("Could not reach the server. Check your connection and that the site is running, then try again.");
    } finally {
      if (!success) setPending(false);
    }
  }

  if (leaving) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center">
            <StillWetLogo height={32} />
          </div>
          <p className="mt-4 text-sm text-zinc-300">Opening the site…</p>
          <p className="mt-2 text-xs text-zinc-600">If this screen stays up, refresh the page.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <StillWetLogo height={32} />
        </div>
        <h1 className="store-dimension-page-title mt-3 text-center text-xl text-zinc-100">
          Enter password
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          This shop is private. Ask the site owner for access.
        </p>
        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <label className="block text-sm text-zinc-400">
            Password
            <div className="relative mt-1.5">
              {passwordError ? <FormFieldValidationBubble message={passwordError} /> : null}
              <PasswordInput
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                autoComplete="current-password"
                wrapperClassName=""
                aria-invalid={passwordError != null}
                className={`w-full rounded-lg border bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none ring-blue-500/30 focus:border-blue-600 focus:ring-2 ${
                  passwordError ? "border-blue-500/50" : "border-zinc-700"
                }`}
              />
            </div>
          </label>
          {error ? <FormValidationAlert message={error} /> : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-900 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
