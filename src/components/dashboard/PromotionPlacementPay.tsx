"use client";

import { useState } from "react";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  dashboardMockPayPromotion,
  startPromotionCheckoutSession,
} from "@/actions/dashboard-promotions";
import { PromotionCheckoutCostLine } from "@/components/dashboard/PromotionCheckoutCostLine";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Pay step: mock form or redirect to Stripe Checkout (no embedded Stripe.js). */
export function PromotionPlacementPay(props: {
  kind: PromotionKind;
  placementOffset: 0 | 1 | 2;
  amountCents: number;
  periodLabel: string;
  mockPay: boolean;
  showCostLine?: boolean;
}) {
  const { kind, placementOffset, amountCents, periodLabel, mockPay, showCostLine = true } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onStripeCheckout() {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const started = await startPromotionCheckoutSession({
        promotionKind: kind,
        placementPeriodOffset: placementOffset,
      });
      if (!started.ok) {
        setError(started.error);
        return;
      }
      window.location.assign(started.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.trim() || "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  if (mockPay) {
    return (
      <form action={dashboardMockPayPromotion} className="mt-3 space-y-2">
        <input type="hidden" name="promotionKind" value={kind} />
        <input type="hidden" name="placementPeriodOffset" value={String(placementOffset)} />
        <p className="text-[11px] text-amber-600/90">Mock checkout — no real charge.</p>
        <button
          type="submit"
          className="rounded border border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100 hover:border-amber-700/50"
        >
          Record mock payment ({formatMoney(amountCents)})
        </button>
      </form>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {showCostLine ? (
        <PromotionCheckoutCostLine
          kind={kind}
          periodLabel={periodLabel}
          amountCents={amountCents}
        />
      ) : null}
      {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void onStripeCheckout()}
        className="rounded border border-violet-900/60 bg-violet-950/30 px-3 py-1.5 text-xs text-violet-200 hover:border-violet-700/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Redirecting…" : `Pay ${formatMoney(amountCents)}`}
      </button>
    </div>
  );
}
