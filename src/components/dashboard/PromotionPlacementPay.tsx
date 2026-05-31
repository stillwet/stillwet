"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  finalizePromotionPurchaseIntent,
  mockPurchasePromotionPlacement,
  redeemPromotionCreditCheckout,
  startPromotionPurchaseIntent,
} from "@/actions/dashboard-promotions";
import { PromotionCheckoutCostLine } from "@/components/dashboard/PromotionCheckoutCostLine";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Inline card pay — same pattern as Google Shopping credit packs (no Stripe Checkout redirect). */
export function PromotionPlacementPay(props: {
  kind: PromotionKind;
  placementOffset: 0 | 1 | 2;
  amountCents: number;
  mockPay: boolean;
  stripePublishableKey: string;
  showCostLine?: boolean;
  promotionCreditsAvailable?: number;
  shopListingId?: string | null;
  onPaid?: () => void;
}) {
  const {
    kind,
    placementOffset,
    amountCents,
    mockPay,
    stripePublishableKey,
    showCostLine = true,
    promotionCreditsAvailable = 0,
    shopListingId,
    onPaid,
  } = props;
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const hasPromotionCredit = promotionCreditsAvailable > 0;
  const displayAmountCents = hasPromotionCredit ? 0 : amountCents;

  useEffect(() => {
    setPaid(false);
    setError(null);
  }, [kind, placementOffset, amountCents, promotionCreditsAvailable]);

  useEffect(() => {
    if (mockPay || hasPromotionCredit) return;
    let cancelled = false;
    const mountEl = mountRef.current;
    if (!mountEl || !stripePublishableKey.trim()) return;

    setReady(false);
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
  }, [stripePublishableKey, mockPay, hasPromotionCredit, kind, placementOffset]);

  async function onUseCredit() {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const r = await redeemPromotionCreditCheckout({
        promotionKind: kind,
        placementPeriodOffset: placementOffset,
        shopListingId: shopListingId ?? undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPaid(true);
      onPaid?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onMockPay() {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const r = await mockPurchasePromotionPlacement({
        promotionKind: kind,
        placementPeriodOffset: placementOffset,
        shopListingId: shopListingId ?? undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPaid(true);
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
      const started = await startPromotionPurchaseIntent({
        promotionKind: kind,
        placementPeriodOffset: placementOffset,
        shopListingId: shopListingId ?? undefined,
      });
      if (!started.ok) {
        setError(started.error);
        return;
      }
      const { error: confirmErr, paymentIntent } = await stripe.confirmCardPayment(
        started.clientSecret,
        { payment_method: { card } },
      );
      if (confirmErr) {
        setError(confirmErr.message ?? "Payment failed.");
        return;
      }
      if (!paymentIntent?.id) {
        setError("Stripe did not return a payment confirmation.");
        return;
      }
      const finalized = await finalizePromotionPurchaseIntent(paymentIntent.id);
      if (!finalized.ok) {
        setError(finalized.error);
        return;
      }
      setPaid(true);
      onPaid?.();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      setError(
        lower.includes("network") || lower.includes("failed to fetch")
          ? "Payment failed due to a network error. Check your connection, VPN, or extensions blocking Stripe."
          : msg.trim() || "Payment failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <p className="mt-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200/90">
        Promotion purchase recorded.
      </p>
    );
  }

  const canPay = mockPay || stripePublishableKey.trim().length > 0;

  return (
    <div className="mt-2 rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-3">
      {showCostLine ? (
        <PromotionCheckoutCostLine kind={kind} amountCents={displayAmountCents} />
      ) : null}
      {hasPromotionCredit ? (
        <div className={showCostLine ? "mt-3" : undefined}>
          <p className="text-[11px] text-emerald-400/90">
            {promotionCreditsAvailable === 1
              ? "You have 1 promotion credit for this placement."
              : `You have ${promotionCreditsAvailable} promotion credits for this placement.`}
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-2 rounded border border-emerald-800/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:border-emerald-700/50 disabled:opacity-50"
            onClick={() => void onUseCredit()}
          >
            {busy ? "Redeeming…" : "Use promotion credit ($0)"}
          </button>
        </div>
      ) : canPay ? (
        mockPay ? (
          <div className={showCostLine ? "mt-3" : undefined}>
            <p className="text-[11px] text-amber-600/90">Mock checkout — no real charge.</p>
            <button
              type="button"
              disabled={busy}
              className="mt-2 rounded border border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100 hover:border-amber-700/50 disabled:opacity-50"
              onClick={() => void onMockPay()}
            >
              {busy ? "Processing…" : `Record mock payment (${formatMoney(amountCents)})`}
            </button>
          </div>
        ) : (
          <div className={showCostLine ? "mt-3 space-y-2" : "space-y-2"}>
            <div
              ref={mountRef}
              className="rounded border border-zinc-700 bg-zinc-900/40 px-3 py-2.5"
            />
            <button
              type="button"
              disabled={!ready || busy}
              className="rounded border border-zinc-500 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void onPay()}
            >
              {busy ? "Processing…" : "Pay with card"}
            </button>
          </div>
        )
      ) : (
        <p className="mt-3 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
          Stripe is not configured for card payments.
        </p>
      )}
      {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}
    </div>
  );
}
