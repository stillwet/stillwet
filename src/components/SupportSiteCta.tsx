"use client";

import { type ReactNode, useEffect, useId, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { startSupportSiteCheckout } from "@/actions/support-site";

function CheckoutSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-zinc-600 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition enabled:hover:bg-white disabled:cursor-wait disabled:opacity-70"
      aria-label={pending ? "Opening Stripe checkout" : "Pay with card"}
    >
      {pending ? "Opening Stripe…" : "Pay with card"}
    </button>
  );
}

export function SupportSiteCta({
  className,
  children,
}: {
  /** Overrides default footer-style button classes (e.g. inline link in body copy). */
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const modal =
    open &&
    createPortal(
      <div
        id={panelId}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div
          className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h3 id={titleId} className="text-base font-semibold text-zinc-100">
            Support the site
          </h3>
          <div id={descId} className="mt-3 space-y-3 text-left text-sm leading-relaxed text-zinc-300">
            <p>
              Voluntary support helps keep the site running independently, and is genuinely appreciated.
            </p>
            <div>
              <p className="font-medium text-zinc-200">Your donation supports upcoming goals</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-400">
                <li>Mobile App (Android)</li>
                <li>Mobile App (iOS)</li>
                <li>Expanded features</li>
                <li>Expanding shipping countries</li>
              </ul>
            </div>
          </div>

          <form action={startSupportSiteCheckout} className="mt-5 space-y-3">
            <div>
              <label htmlFor={`${panelId}-tip-usd`} className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Amount (USD)
              </label>
              <div className="mt-2 flex items-center gap-2">
                <span className="select-none text-sm text-zinc-500" aria-hidden>
                  $
                </span>
                <input
                  id={`${panelId}-tip-usd`}
                  type="number"
                  name="tipUsd"
                  inputMode="decimal"
                  min={1}
                  step={0.01}
                  required
                  placeholder="Enter amount"
                  autoComplete="transaction-amount"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-blue-500/0 transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
            <CheckoutSubmitButton />
          </form>
          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-zinc-800 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            onClick={() => setOpen(false)}
          >
            Not now
          </button>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        className={
          className ??
          "store-dimension-brand cursor-pointer text-xs uppercase tracking-[0.2em] text-blue-400/80 transition hover:text-blue-300/90"
        }
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {children ?? "Support the site <3"}
      </button>
      {modal}
    </>
  );
}
