"use client";

import { useActionState, useEffect, useState } from "react";
import { startCreatorGiftCheckout, type StartCreatorGiftCheckoutResult } from "@/actions/gift-creator";
import { FormFieldValidationBubble, FormValidationAlert } from "@/components/FormFieldValidationBubble";
import { SHOP_SETUP_FEE_CENTS } from "@/lib/creator-gift-codes";
import { emailFieldError } from "@/lib/form-field-validation";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function GiftShopSetupForm(props: { onBack: () => void }) {
  const [emailError, setEmailError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<
    StartCreatorGiftCheckoutResult | undefined,
    FormData
  >(startCreatorGiftCheckout, undefined);

  useEffect(() => {
    if (state?.ok) window.location.href = state.url;
  }, [state]);

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={props.onBack}
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Back
      </button>

      <form
        action={action}
        noValidate
        onSubmit={(e) => {
          const fd = new FormData(e.currentTarget);
          const error = emailFieldError(fd.get("purchaserEmail"));
          if (error) {
            e.preventDefault();
            setEmailError(error);
            return;
          }
          setEmailError(null);
        }}
        className="mt-6 space-y-5"
      >
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">
            Shop setup fee -- {formatUsd(SHOP_SETUP_FEE_CENTS).replace(".00", "")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Covers the one-time shop setup account fee when the creator creates their shop.
          </p>
        </div>

        <label className="block text-sm text-zinc-400">
          Your email
          <div className="relative mt-1">
            {emailError ? <FormFieldValidationBubble message={emailError} /> : null}
            <input
              type="email"
              name="purchaserEmail"
              autoComplete="email"
              aria-invalid={emailError != null}
              onChange={() => setEmailError(null)}
              className={`w-full rounded-lg border bg-zinc-900 px-3 py-2 text-zinc-100 ${
                emailError ? "border-blue-500/50" : "border-zinc-700"
              }`}
            />
          </div>
          <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
            We&apos;ll email you a setup code to give the creator.
            <span className="mt-1 block">
              They redeem the code when they sign up for an account.
            </span>
          </span>
        </label>

        {state && !state.ok ? <FormValidationAlert message={state.error} /> : null}

        <button
          type="submit"
          disabled={pending || state?.ok}
          className="w-full rounded-lg border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending || state?.ok ? "Starting checkout…" : "Continue to checkout"}
        </button>
      </form>
    </div>
  );
}
