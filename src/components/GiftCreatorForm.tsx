"use client";

import { useActionState, useEffect, useState } from "react";
import { startCreatorGiftCheckout, type StartCreatorGiftCheckoutResult } from "@/actions/gift-creator";
import { LISTING_CREDIT_PACKS } from "@/lib/listing-credit-packs";

export function GiftCreatorForm() {
  const [includeListingCredits, setIncludeListingCredits] = useState(false);
  const [state, action, pending] = useActionState<
    StartCreatorGiftCheckoutResult | undefined,
    FormData
  >(startCreatorGiftCheckout, undefined);

  useEffect(() => {
    if (state?.ok) window.location.href = state.url;
  }, [state]);

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block text-sm text-zinc-400">
        Your email
        <input
          type="email"
          name="purchaserEmail"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
        />
        <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
          We&apos;ll email you a unique code, and you share the code with a creator.
        </span>
      </label>

      <fieldset className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <legend className="px-1 text-sm font-medium text-zinc-300">Gift options</legend>
        <label className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
          <input type="checkbox" name="includeSetup" defaultChecked className="mt-1" />
          <span>
            <span className="block font-medium text-zinc-100">Shop setup fee gift — $15.00</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
              Covers the one-time shop setup fee.
            </span>
          </span>
        </label>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={includeListingCredits}
              onChange={(e) => setIncludeListingCredits(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-zinc-100">Listing credit gift</span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                Covers some additional listings.
              </span>
            </span>
          </label>
          <select
            name="listingCreditPackId"
            disabled={!includeListingCredits}
            defaultValue={LISTING_CREDIT_PACKS[0]?.id ?? ""}
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {LISTING_CREDIT_PACKS.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {state && !state.ok ? (
        <p className="text-sm text-amber-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || state?.ok}
        className="w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
      >
        {pending || state?.ok ? "Starting checkout…" : "Continue to checkout"}
      </button>
    </form>
  );
}
