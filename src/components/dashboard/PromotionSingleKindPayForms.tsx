"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  dashboardMockPayPromotion,
  finalizePromotionPurchaseIntent,
  startPromotionPurchaseIntent,
} from "@/actions/dashboard-promotions";
import {
  promotionKindLabel,
  promotionKindSurfaceDescription,
  promotionPriceCentsForKind,
} from "@/lib/promotions";
import {
  PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER,
  PROMOTION_ACTIVE_DAYS,
} from "@/lib/promotion-policy-shared";
import type { PromotionMonthlySlotUi } from "@/components/dashboard/ListingsPromotedSection";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type CheckoutPhase = "pick_period" | "checkout";

export function MockPromotionPaySingleKind(props: {
  kind: PromotionKind;
  slotUi: PromotionMonthlySlotUi;
  placementOffset: 0 | 1 | 2;
  /** Parent handled period + listing; only mount pay UI (Stripe chunk not loaded until this). */
  payOnly?: boolean;
  lockedListingId?: string;
  phase?: CheckoutPhase;
  setPlacementOffset?: (o: 0 | 1 | 2) => void;
  liveListingPicklist?: { id: string; label: string }[];
  onContinueToListing?: () => void;
  listingsLoading?: boolean;
}) {
  const {
    kind,
    slotUi,
    placementOffset,
    payOnly = false,
    lockedListingId,
    phase = "checkout",
    setPlacementOffset = () => {},
    liveListingPicklist = [],
    onContinueToListing = () => {},
    listingsLoading,
  } = props;

  const needsListing = kind !== PromotionKind.FEATURED_SHOP_HOME;

  const selectedChoice = slotUi.periodChoices.find((c) => c.offset === placementOffset);
  const priceCents =
    selectedChoice?.selectable === true
      ? selectedChoice.amountCents
      : slotUi.offer?.amountCents ?? promotionPriceCentsForKind(kind);

  const periodFieldset = (
    <fieldset className="space-y-1.5 rounded-md border border-zinc-800/80 p-2">
      <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Placement period
      </legend>
      <div className="flex flex-col gap-1.5">
        {slotUi.periodChoices.map((c) => (
          <label
            key={c.offset}
            className={`flex cursor-pointer items-start gap-2 text-[11px] ${
              c.selectable ? "text-zinc-300" : "text-zinc-600"
            }`}
          >
            <input
              type="radio"
              name="placementPeriodOffset"
              value={String(c.offset)}
              checked={placementOffset === c.offset}
              disabled={!c.selectable || (phase === "checkout" && needsListing)}
              onChange={() => setPlacementOffset(c.offset)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-zinc-200">{c.placementMonthLabel}</span>
              {" — "}
              {formatMoney(c.amountCents)}
              {c.isProrated ? (
                <span className="text-zinc-500"> (prorated)</span>
              ) : null}
              {c.isSecondFuturePeriod ? (
                <span className="text-zinc-500"> ({PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×)</span>
              ) : null}
              {!c.selectable && c.disabledReason ? (
                <span className="block text-zinc-600"> — {c.disabledReason}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  if (!payOnly && needsListing && phase === "pick_period") {
    return (
      <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-[11px] text-amber-600/90">
          Mock checkout — choose a placement window first; you&apos;ll pick a listing next.
        </p>
        {slotUi.offer?.isDeferred ? (
          <p className="text-[11px] text-amber-200/90">
            Period slots: {slotUi.slotsUsedUtcThisMonth}/{slotUi.monthlyCap} used. This mock records{" "}
            {slotUi.offer.placementMonthLabel} when applicable.
          </p>
        ) : null}
        {periodFieldset}
        <button
          type="button"
          disabled={!selectedChoice?.selectable || listingsLoading}
          onClick={() => onContinueToListing()}
          className="rounded border border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100 hover:border-amber-700/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {listingsLoading ? "Loading listings…" : "Continue — choose listing"}
        </button>
      </div>
    );
  }

  if (!payOnly && needsListing && phase === "checkout" && liveListingPicklist.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500">
        Listing-targeted promotions need at least one listing that is <strong className="text-zinc-400">Live</strong> on
        your storefront. Publish a listing first, or choose Featured shop.
      </div>
    );
  }

  const periodSummary =
    (payOnly || (needsListing && phase === "checkout")) && selectedChoice?.selectable ? (
      <div className="rounded-md border border-zinc-800/80 bg-zinc-900/30 px-3 py-2 text-[11px] text-zinc-300">
        <span className="font-medium text-zinc-200">{selectedChoice.placementMonthLabel}</span>
        {" — "}
        {formatMoney(priceCents)}
        {selectedChoice.isProrated ? <span className="text-zinc-500"> (prorated)</span> : null}
      </div>
    ) : null;

  return (
    <form
      action={dashboardMockPayPromotion}
      className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
    >
      <input type="hidden" name="promotionKind" value={kind} />
      <input type="hidden" name="placementPeriodOffset" value={String(placementOffset)} />
      <p className="text-[11px] text-amber-600/90">
        Mock checkout — no real charge. Two-week Pacific windows and proration as in the policy blurb.
      </p>
      <p className="text-[11px] text-zinc-400">
        <span className="font-medium text-zinc-200">{promotionKindLabel(kind)}</span>
        {" — "}
        {promotionKindSurfaceDescription(kind)}
      </p>
      {slotUi.offer?.isDeferred ? (
        <p className="text-[11px] text-amber-200/90">
          Period full or deferred pricing may apply ({slotUi.slotsUsedUtcThisMonth}/{slotUi.monthlyCap} this window).
          Recording {slotUi.offer.placementMonthLabel} at{" "}
          {slotUi.offer.isSecondFuturePeriod
            ? `${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×`
            : "standard rate"}{" "}
          ({formatMoney(priceCents)}).
        </p>
      ) : null}
      {payOnly ? (
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Chosen placement</p>
          {periodSummary}
          {needsListing ? (
            <p className="text-[11px] text-zinc-500">
              After payment you can apply this credit to a live listing from your dashboard.
            </p>
          ) : null}
        </>
      ) : needsListing && phase === "checkout" ? (
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Chosen placement</p>
          {periodSummary}
        </>
      ) : (
        periodFieldset
      )}
      {needsListing && lockedListingId?.trim() ? (
        <input type="hidden" name="shopListingId" value={lockedListingId.trim()} />
      ) : payOnly && needsListing ? (
        <p className="text-[11px] leading-snug text-zinc-500">
          Listing assignment happens after payment.
        </p>
      ) : needsListing ? (
        <label className="block text-[11px] text-zinc-500">
          Select an active listing
          <select
            name="shopListingId"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
          >
            <option value="">Skip — assign after payment</option>
            {liveListingPicklist.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-[11px] leading-snug text-zinc-500">
          This boost applies to your entire shop (not an individual listing).
        </p>
      )}
      <button
        type="submit"
        disabled={!selectedChoice?.selectable}
        className="rounded border border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100 hover:border-amber-700/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Record mock promotion payment ({formatMoney(priceCents)})
      </button>
    </form>
  );
}

export function PromotionCardPaySingleKind(props: {
  kind: PromotionKind;
  slotUi: PromotionMonthlySlotUi;
  stripePublishableKey: string;
  placementOffset: 0 | 1 | 2;
  payOnly?: boolean;
  lockedListingId?: string;
  phase?: CheckoutPhase;
  setPlacementOffset?: (o: 0 | 1 | 2) => void;
  liveListingPicklist?: { id: string; label: string }[];
  onContinueToListing?: () => void;
  listingsLoading?: boolean;
  onPaymentFinished?: () => void;
}) {
  const {
    kind,
    slotUi,
    stripePublishableKey,
    placementOffset,
    payOnly = false,
    lockedListingId,
    phase = "checkout",
    setPlacementOffset = () => {},
    liveListingPicklist = [],
    onContinueToListing = () => {},
    listingsLoading,
    onPaymentFinished,
  } = props;

  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listingId, setListingId] = useState(lockedListingId?.trim() ?? "");

  const needsListing = kind !== PromotionKind.FEATURED_SHOP_HOME;
  const effectiveListingId = lockedListingId?.trim() || listingId;

  useEffect(() => {
    if (lockedListingId?.trim()) setListingId(lockedListingId.trim());
    else if (!needsListing) setListingId("");
  }, [needsListing, lockedListingId]);

  useEffect(() => {
    if (!payOnly && phase !== "checkout") {
      setReady(false);
      try {
        cardRef.current?.destroy();
      } catch {
        /* ignore */
      }
      cardRef.current = null;
      stripeRef.current = null;
      return;
    }
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
        const lower = msg.toLowerCase();
        setError(
          lower.includes("network") || lower.includes("failed to fetch")
            ? "Could not reach Stripe (check internet, VPN, firewall, or extensions blocking js.stripe.com)."
            : `Could not load Stripe: ${msg}`,
        );
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
  }, [stripePublishableKey, phase, payOnly]);

  const selectedChoice = slotUi.periodChoices.find((c) => c.offset === placementOffset);
  const priceCents =
    selectedChoice?.selectable === true
      ? selectedChoice.amountCents
      : slotUi.offer?.amountCents ?? promotionPriceCentsForKind(kind);

  async function onPay() {
    setError(null);
    if (!ready || busy) return;
    const stripe = stripeRef.current;
    const card = cardRef.current;
    if (!stripe || !card) {
      setError("Card form is not ready yet.");
      return;
    }
    if (!selectedChoice?.selectable) {
      setError("Choose an available placement period.");
      return;
    }
    setBusy(true);
    try {
      const started = await startPromotionPurchaseIntent({
        promotionKind: kind,
        ...(effectiveListingId.trim() ? { shopListingId: effectiveListingId.trim() } : {}),
        placementPeriodOffset: placementOffset,
      });
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
      const finalized = await finalizePromotionPurchaseIntent(paymentIntent.id);
      if (!finalized.ok) {
        setError(finalized.error);
        return;
      }
      onPaymentFinished?.();
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

  const periodFieldset = (
    <fieldset className="space-y-1.5 rounded-md border border-zinc-800/80 p-2">
      <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Placement period
      </legend>
      <div className="flex flex-col gap-1.5">
        {slotUi.periodChoices.map((c) => (
          <label
            key={c.offset}
            className={`flex cursor-pointer items-start gap-2 text-[11px] ${
              c.selectable ? "text-zinc-300" : "text-zinc-600"
            }`}
          >
            <input
              type="radio"
              name="promotion-placement"
              value={String(c.offset)}
              checked={placementOffset === c.offset}
              disabled={!c.selectable || (phase === "checkout" && needsListing)}
              onChange={() => setPlacementOffset(c.offset)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-zinc-200">{c.placementMonthLabel}</span>
              {" — "}
              {formatMoney(c.amountCents)}
              {c.isProrated ? <span className="text-zinc-500"> (prorated)</span> : null}
              {c.isSecondFuturePeriod ? (
                <span className="text-zinc-500"> ({PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}×)</span>
              ) : null}
              {!c.selectable && c.disabledReason ? (
                <span className="block text-zinc-600"> — {c.disabledReason}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  if (!payOnly && needsListing && phase === "pick_period") {
    return (
      <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-xs text-zinc-400">
          Choose a placement window first. On the next step we&apos;ll load your live listings to attach this promotion.
        </p>
        {periodFieldset}
        <button
          type="button"
          disabled={!selectedChoice?.selectable || listingsLoading}
          onClick={() => onContinueToListing()}
          className="rounded border border-violet-900/50 bg-violet-950/30 px-3 py-1.5 text-xs text-violet-100 hover:border-violet-700/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {listingsLoading ? "Loading listings…" : "Continue — choose listing & pay"}
        </button>
      </div>
    );
  }

  if (!payOnly && needsListing && phase === "checkout" && liveListingPicklist.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500">
        Listing-targeted promotions need at least one listing that is <strong className="text-zinc-400">Live</strong> on
        your storefront.
      </div>
    );
  }

  const stripePeriodSummary =
    (payOnly || (needsListing && phase === "checkout")) && selectedChoice?.selectable ? (
      <div className="rounded-md border border-zinc-800/80 bg-zinc-900/30 px-3 py-2 text-[11px] text-zinc-300">
        <span className="font-medium text-zinc-200">{selectedChoice.placementMonthLabel}</span>
        {" — "}
        {formatMoney(priceCents)}
        {selectedChoice.isProrated ? <span className="text-zinc-500"> (prorated)</span> : null}
      </div>
    ) : null;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="text-xs text-zinc-400">
        You will be charged <strong className="text-zinc-200">{formatMoney(priceCents)}</strong> for{" "}
        <strong className="text-zinc-200">{promotionKindLabel(kind)}</strong>.
      </p>
      <p className="text-[11px] leading-snug text-zinc-600">{promotionKindSurfaceDescription(kind)}</p>
      {slotUi.offer?.isDeferred ? (
        <p className="text-[11px] text-amber-200/85">
          Placement window may be deferred ({slotUi.slotsUsedUtcThisMonth} / {slotUi.monthlyCap} slots). This purchase
          targets {slotUi.offer.placementMonthLabel} (Pacific)
          {slotUi.offer.isSecondFuturePeriod
            ? ` at ${PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER}× the standard rate`
            : " at the standard rate for that window"}
          .
        </p>
      ) : null}
      {payOnly ? (
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Chosen placement</p>
          {stripePeriodSummary}
          {needsListing ? (
            <p className="text-[11px] text-zinc-500">
              After payment you can apply this credit to a live listing from your dashboard.
            </p>
          ) : null}
        </>
      ) : needsListing && phase === "checkout" ? (
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Chosen placement</p>
          {stripePeriodSummary}
        </>
      ) : (
        periodFieldset
      )}
      {payOnly && needsListing ? (
        <p className="text-[11px] leading-snug text-zinc-500">Listing assignment happens after payment.</p>
      ) : needsListing && lockedListingId?.trim() ? null : needsListing ? (
        <label className="block text-[11px] text-zinc-500">
          Select an active listing (optional)
          <select
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
          >
            <option value="">Assign after payment</option>
            {liveListingPicklist.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-[11px] leading-snug text-zinc-500">
          This boost applies to your entire shop (not an individual listing).
        </p>
      )}
      <p className="text-[11px] text-zinc-500">
        Your card is charged immediately (no redirect). Listing promotions share the same two-week Pacific window (
        {PROMOTION_ACTIVE_DAYS} days); mid-period buys are prorated by remaining days. Cap: {slotUi.monthlyCap}{" "}
        purchases per period for this placement type.
      </p>
      <div ref={mountRef} className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-2" />
      {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
      <button
        type="button"
        disabled={!ready || busy || !selectedChoice?.selectable}
        onClick={() => void onPay()}
        className="rounded border border-violet-900/60 bg-violet-950/30 px-3 py-1.5 text-xs text-violet-200 hover:border-violet-700/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Processing…" : `Pay ${formatMoney(priceCents)}`}
      </button>
    </div>
  );
}
