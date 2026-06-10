"use client";

import { type ReactNode, useEffect, useId, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { startSupportSiteCheckout } from "@/actions/support-site";
import { MIN_SUPPORT_TIP_USD, supportTipInputError } from "@/lib/support-site";

function SupportTipValidationBubble({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 flex max-w-[16rem] items-start gap-2 rounded-lg border border-blue-500/30 bg-zinc-950 px-2.5 py-2 text-xs leading-snug text-zinc-200 shadow-lg shadow-black/40 ring-1 ring-blue-500/15"
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-blue-500/40 bg-blue-950/60 text-[10px] font-semibold leading-none text-blue-300"
        aria-hidden
      >
        !
      </span>
      <span>{message}</span>
    </div>
  );
}

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
  const [tipFieldError, setTipFieldError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open) setTipFieldError(null);
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
            Support The Site
          </h3>
          <div id={descId} className="mt-3 space-y-3 text-left text-sm leading-relaxed text-zinc-300">
            <p>
              Supporting gets you a{" "}
              <span className="font-medium text-blue-400/90">VOTE</span> on upcoming feature priority!
            </p>
            <div>
              <ul className="list-inside list-disc space-y-1 text-zinc-400">
                <li>Expanding shop ownership / shipping to other countries</li>
                <li>Expanded features (more item types, off-site marketing, etc.)</li>
                <li>Mobile App (Android & iOS)</li>
              </ul>
            </div>
          </div>

          <form
            action={startSupportSiteCheckout}
            noValidate
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              const fd = new FormData(e.currentTarget);
              const error = supportTipInputError(fd.get("tipUsd"));
              if (error) {
                e.preventDefault();
                setTipFieldError(error);
                return;
              }
              setTipFieldError(null);
            }}
          >
            <div>
              <label htmlFor={`${panelId}-tip-usd`} className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Amount (USD)
              </label>
              <div className="relative mt-2 flex items-center gap-2">
                {tipFieldError ? <SupportTipValidationBubble message={tipFieldError} /> : null}
                <span className="select-none text-sm text-zinc-500" aria-hidden>
                  $
                </span>
                <input
                  id={`${panelId}-tip-usd`}
                  type="number"
                  name="tipUsd"
                  inputMode="decimal"
                  min={MIN_SUPPORT_TIP_USD}
                  step={0.01}
                  placeholder="Enter amount"
                  autoComplete="transaction-amount"
                  aria-invalid={tipFieldError ? true : undefined}
                  aria-describedby={tipFieldError ? `${panelId}-tip-error` : undefined}
                  onChange={() => {
                    if (tipFieldError) setTipFieldError(null);
                  }}
                  className={`w-full rounded-lg border bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-blue-500/0 transition placeholder:text-zinc-600 focus:ring-2 focus:ring-blue-500/30 ${
                    tipFieldError
                      ? "border-blue-500/45 focus:border-blue-500/55"
                      : "border-zinc-700 focus:border-zinc-500"
                  }`}
                />
                {tipFieldError ? (
                  <span id={`${panelId}-tip-error`} className="sr-only">
                    {tipFieldError}
                  </span>
                ) : null}
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
