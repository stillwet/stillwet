"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import {
  finalizeListingCreditPackPaymentIntent,
  mockPurchaseListingCreditPack,
  startListingCreditPackPaymentIntent,
} from "@/actions/dashboard-listing-credits";
import type { ListingCreditPack } from "@/lib/listing-credit-packs";

export function ListingCreditPackPay(props: {
  pack: ListingCreditPack;
  stripePublishableKey: string;
  mockListingFeeCheckout: boolean;
  onPaid?: () => void;
}) {
  const { pack, stripePublishableKey, mockListingFeeCheckout, onPaid } = props;
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mockListingFeeCheckout) return;
    let cancelled = false;
    const mountEl = mountRef.current;
    if (!mountEl || !stripePublishableKey.trim()) return;

    (async () => {
      try {
        const stripe = await loadStripe(stripePublishableKey);
        if (cancelled || !stripe) {
          if (!cancelled) setError("Could not load Stripe.");
          return;
        }
        stripeRef.current = stripe;
        const elements = stripe.elements();
        const card = elements.create("card", {
          style: {
            base: {
              color: "#e4e4e7",
              fontSize: "14px",
              "::placeholder": { color: "#71717a" },
            },
            invalid: { color: "#fca5a5" },
          },
        });
        card.mount(mountEl);
        cardRef.current = card;
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Could not load Stripe: ${msg}`);
      }
    })();

    return () => {
      cancelled = true;
      try {
        cardRef.current?.destroy();
      } catch {
        /* ignore */
      }
      cardRef.current = null;
      stripeRef.current = null;
    };
  }, [stripePublishableKey, mockListingFeeCheckout]);

  async function onMockPay() {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const r = await mockPurchaseListingCreditPack(pack.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onPaid?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onPay() {
    setError(null);
    if (!ready || busy) return;
    const stripe = stripeRef.current;
    const card = cardRef.current;
    if (!stripe || !card) {
      setError("Card form is not ready yet.");
      return;
    }
    setBusy(true);
    try {
      const started = await startListingCreditPackPaymentIntent(pack.id);
      if (!started.ok) {
        setError(started.error);
        return;
      }
      const { error: confirmErr, paymentIntent } = await stripe.confirmCardPayment(started.clientSecret, {
        payment_method: { card },
      });
      if (confirmErr) {
        setError(confirmErr.message ?? "Payment failed.");
        return;
      }
      if (!paymentIntent?.id) {
        setError("Stripe did not return a payment confirmation.");
        return;
      }
      const finalized = await finalizeListingCreditPackPaymentIntent(paymentIntent.id);
      if (!finalized.ok) {
        setError(finalized.error);
        return;
      }
      onPaid?.();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.trim() || "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  if (mockListingFeeCheckout) {
    return (
      <div className="mt-3">
        <button
          type="button"
          disabled={busy}
          className="rounded border border-blue-900/60 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-700/60 disabled:opacity-50"
          onClick={onMockPay}
        >
          {busy ? "Processing…" : "Buy (mock checkout)"}
        </button>
        {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div ref={mountRef} className="rounded border border-zinc-700 bg-zinc-900/40 px-3 py-2.5" />
      <button
        type="button"
        disabled={!ready || busy}
        className="rounded border border-zinc-500 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onPay}
      >
        {busy ? "Processing…" : "Buy"}
      </button>
      {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
    </div>
  );
}
