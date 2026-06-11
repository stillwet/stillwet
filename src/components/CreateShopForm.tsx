"use client";

import Link from "next/link";
import { useState } from "react";
import { createShopFromSignup } from "@/actions/shop-auth";
import { TermsConditionsDialog } from "@/components/TermsConditionsDialog";
import { FormValidationAlert } from "@/components/FormFieldValidationBubble";
import { PasswordInput } from "@/components/PasswordInput";
import { emailFieldError, requiredFieldError } from "@/lib/form-field-validation";
import { SHOP_SETUP_FEE_CENTS } from "@/lib/creator-gift-codes";

export function CreateShopForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [setupMethod, setSetupMethod] = useState<"pay" | "code" | "">("");
  const [setupCode, setSetupCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const canSubmit =
    termsAccepted &&
    (setupMethod === "pay" || (setupMethod === "code" && setupCode.trim().length > 0));

  return (
    <form
      className="mt-8 space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const passwordValue = fd.get("password");
        const validationError =
          emailFieldError(fd.get("email")) ??
          requiredFieldError(passwordValue, "a password") ??
          (typeof passwordValue === "string" && passwordValue.length < 10
            ? "Password must be at least 10 characters."
            : null);
        if (validationError) {
          setFieldError(validationError);
          return;
        }
        setFieldError(null);
        setPending(true);
        try {
          const fd = new FormData(e.currentTarget);
          const r = await createShopFromSignup(undefined, fd);
          if (r?.error) setError(r.error);
          if (r?.redirectTo) window.location.href = r.redirectTo;
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
          autoComplete="email"
          onChange={() => setFieldError(null)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
        />
      </label>
      <label className="block text-sm text-zinc-400">
        Password
        <PasswordInput
          name="password"
          minLength={10}
          autoComplete="new-password"
          onChange={() => setFieldError(null)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
        />
      </label>
      <fieldset className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <legend className="px-1 text-sm font-medium text-zinc-300">
          Opening a shop requires a one time creation fee
        </legend>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400">
          <input
            type="radio"
            name="setupMethod"
            value="pay"
            checked={setupMethod === "pay"}
            onChange={() => setSetupMethod("pay")}
            className="mt-1"
          />
          <span>
            <span className="block text-zinc-200">
              Pay ${(SHOP_SETUP_FEE_CENTS / 100).toFixed(2)} shop creation fee
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Payment processing fee is added at checkout.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400">
          <input
            type="radio"
            name="setupMethod"
            value="code"
            checked={setupMethod === "code"}
            onChange={() => setSetupMethod("code")}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="block text-zinc-200">Enter coupon code</span>
            <input
              type="text"
              name="setupCode"
              autoComplete="off"
              placeholder="Code"
              value={setupCode}
              onChange={(e) => {
                setSetupCode(e.target.value);
                if (setupMethod !== "code") setSetupMethod("code");
              }}
              disabled={setupMethod === "pay"}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 uppercase tracking-[0.16em] text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">
              People can{" "}
              <Link href="/gift-creator" className="text-blue-400/80 hover:text-blue-300 hover:underline">
                gift a shop setup fee
              </Link>
              .
            </span>
          </span>
        </label>
      </fieldset>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-zinc-400">
        <input
          type="checkbox"
          name="termsAccepted"
          value="yes"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 shrink-0"
        />
        <span>
          By clicking this checkbox you agree to Still Wet&apos;s{" "}
          <button
            type="button"
            onClick={() => setTermsDialogOpen(true)}
            className="text-blue-400/90 underline-offset-2 hover:text-blue-300 hover:underline"
          >
            terms &amp; conditions
          </button>
          .
        </span>
      </label>
      <TermsConditionsDialog open={termsDialogOpen} onClose={() => setTermsDialogOpen(false)} />
      {fieldError ? <FormValidationAlert message={fieldError} /> : null}
      {error ? <FormValidationAlert message={error} /> : null}
      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {pending
          ? "Starting…"
          : setupMethod === "pay"
            ? "Continue to payment"
            : setupMethod === "code"
              ? "Create shop with code"
              : "Select option"}
      </button>
    </form>
  );
}
