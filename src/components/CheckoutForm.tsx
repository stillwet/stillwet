"use client";

import { useEffect, useState } from "react";
import { startCheckout } from "@/actions/checkout";
import { StripeEmbeddedCheckoutOverlay } from "@/components/StripeEmbeddedCheckoutOverlay";
import {
  MAX_CHECKOUT_TIP_CENTS,
  clampCheckoutTipCents,
} from "@/lib/checkout-tip";
import { buyerPaymentProcessingFeeCents } from "@/lib/stripe-card-processing-fee";
import { STOREFRONT_BUYER_CHECKOUT_DISABLED_MESSAGE } from "@/lib/storefront-buyer-checkout";

type Props = {
  subtotalCents: number;
  shippingCents: number;
  estimatedSalesTaxRate: number | null;
  paymentProcessingIncludeTaxService?: boolean;
  buyerCheckoutDisabled?: boolean;
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CheckoutForm({
  subtotalCents,
  shippingCents,
  estimatedSalesTaxRate,
  paymentProcessingIncludeTaxService = false,
  buyerCheckoutDisabled = false,
}: Props) {
  const [tipInput, setTipInput] = useState("0.00");
  const [tipCents, setTipCents] = useState(0);
  const [tipMaxNotice, setTipMaxNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [embeddedClientSecret, setEmbeddedClientSecret] = useState<string | null>(null);

  const stripePublishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";

  const taxableCents = subtotalCents;
  const taxCents =
    estimatedSalesTaxRate != null && taxableCents > 0
      ? Math.round(taxableCents * estimatedSalesTaxRate)
      : estimatedSalesTaxRate != null
        ? 0
        : null;
  const paymentProcessingCents = buyerPaymentProcessingFeeCents({
    subtotalCents,
    shippingCents,
    tipCents,
    includeTaxService: paymentProcessingIncludeTaxService,
  });
  const preTaxTotalCents =
    subtotalCents + tipCents + shippingCents + paymentProcessingCents;
  const grandTotalCents = preTaxTotalCents + (taxCents ?? 0);

  useEffect(() => {
    if (!tipMaxNotice) return;
    const timer = window.setTimeout(() => setTipMaxNotice(false), 2000);
    return () => window.clearTimeout(timer);
  }, [tipMaxNotice]);

  function showTipMaxNotice() {
    setTipMaxNotice(true);
  }

  function applyTipCents(cents: number) {
    if (cents > MAX_CHECKOUT_TIP_CENTS) {
      showTipMaxNotice();
      setTipCents(MAX_CHECKOUT_TIP_CENTS);
      setTipInput((MAX_CHECKOUT_TIP_CENTS / 100).toFixed(2));
      return;
    }
    setTipCents(cents);
  }

  function sanitizeTipInput(raw: string): string {
    const cleaned = raw.replace(/[^\d.]/g, "");
    const dot = cleaned.indexOf(".");
    if (dot === -1) return cleaned;
    return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
  }

  function syncTipFromInput(raw: string) {
    const sanitized = sanitizeTipInput(raw);
    if (sanitized === "" || sanitized === ".") {
      setTipInput(sanitized);
      setTipCents(0);
      return;
    }
    const n = parseFloat(sanitized);
    if (!Number.isFinite(n) || n < 0) {
      setTipInput(sanitized);
      return;
    }
    const cents = Math.round(n * 100);
    if (cents > MAX_CHECKOUT_TIP_CENTS) {
      applyTipCents(cents);
      return;
    }
    setTipInput(sanitized);
    setTipCents(cents);
  }

  function formatTipOnBlur() {
    const trimmed = tipInput.trim();
    if (trimmed === "" || trimmed === ".") {
      setTipInput("0.00");
      setTipCents(0);
      return;
    }
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      setTipInput("0.00");
      setTipCents(0);
      return;
    }
    const cents = Math.round(n * 100);
    if (cents > MAX_CHECKOUT_TIP_CENTS) {
      showTipMaxNotice();
    }
    const clamped = clampCheckoutTipCents(cents);
    setTipCents(clamped);
    setTipInput((clamped / 100).toFixed(2));
  }

  return (
    <>
      <form
        className="w-full space-y-8 text-center"
        action={async (formData) => {
          setError(null);
          setPending(true);
          formData.set("tipCents", String(tipCents));
          try {
            const r = await startCheckout(formData);
            if (r.ok) {
              if (r.mode === "redirect") {
                window.location.href = r.url;
                return;
              }
              if (!stripePublishableKey) {
                setError("Stripe publishable key is not configured.");
                return;
              }
              setEmbeddedClientSecret(r.clientSecret);
              return;
            }
            setError(r.error);
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="store-dimension-panel border-zinc-800/60 p-5 text-left text-sm text-zinc-400 shadow-none">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="text-zinc-200">{formatPrice(subtotalCents)}</span>
          </div>
          {subtotalCents > 0 ? (
            <div className="mt-2 flex justify-between">
              <span>Payment Processing</span>
              <span className="text-zinc-200">{formatPrice(paymentProcessingCents)}</span>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="checkout-tip" className="block leading-none">
                Tip
              </label>
              <p className="mt-1 text-[10px] italic leading-tight text-zinc-600">
                (Optional) 25 cent platform fee; the rest goes to the creator.
              </p>
            </div>
            <div className="relative shrink-0 self-center">
              {tipMaxNotice ? (
                <div
                  role="status"
                  className="pointer-events-none absolute bottom-full right-0 z-10 mb-1 whitespace-nowrap rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] leading-none text-amber-200/90 shadow-md"
                >
                  ${MAX_CHECKOUT_TIP_CENTS / 100} max tip
                </div>
              ) : null}
              <input
                id="checkout-tip"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label="Tip amount in dollars"
                value={tipInput}
                onChange={(e) => syncTipFromInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={formatTipOnBlur}
                className="h-7 w-[3.25rem] shrink-0 rounded-md border border-zinc-700 bg-zinc-950 px-1.5 text-right text-sm tabular-nums leading-none text-zinc-200 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-2 flex justify-between">
            <span>Sales tax</span>
            {taxCents != null ? (
              <span className="text-zinc-200">{formatPrice(taxCents)}</span>
            ) : (
              <span className="text-right text-xs text-zinc-500 italic">Calculated at checkout</span>
            )}
          </div>
          <div className="mt-2 flex justify-between">
            <span>Shipping</span>
            <span className="text-zinc-200">
              {shippingCents === 0 ? "Free shipping" : formatPrice(shippingCents)}
            </span>
          </div>
          <div className="mt-3 flex justify-between border-t border-zinc-800/80 pt-3 font-medium text-zinc-100">
            <span>Estimated total</span>
            <span>
              {estimatedSalesTaxRate != null
                ? formatPrice(grandTotalCents)
                : `${formatPrice(preTaxTotalCents)} + tax`}
            </span>
          </div>
          {!buyerCheckoutDisabled ? (
            <p className="mt-3 text-center text-xs leading-relaxed text-zinc-600">
              Tax is finalized at payment from your shipping address.
            </p>
          ) : null}
        </div>

        {buyerCheckoutDisabled ? (
          <p
            className="rounded-lg border border-blue-900/40 bg-blue-950/25 px-3 py-2 text-center text-sm leading-relaxed text-blue-200/90"
            role="status"
          >
            {STOREFRONT_BUYER_CHECKOUT_DISABLED_MESSAGE}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-amber-950/50 px-3 py-2 text-center text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || buyerCheckoutDisabled}
          className="w-full rounded-xl bg-blue-900 py-3 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buyerCheckoutDisabled
            ? "Checkout unavailable"
            : pending
              ? "Loading checkout…"
              : "Continue to payment"}
        </button>
      </form>
      {embeddedClientSecret && stripePublishableKey ? (
        <StripeEmbeddedCheckoutOverlay
          open
          clientSecret={embeddedClientSecret}
          stripePublishableKey={stripePublishableKey}
          onClose={() => setEmbeddedClientSecret(null)}
        />
      ) : null}
    </>
  );
}
