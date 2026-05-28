"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignGoogleShoppingListings,
  type DashboardGoogleShoppingActionResult,
} from "@/actions/dashboard-google-shopping";
import { ShopGoogleShoppingPackPay } from "@/components/dashboard/ShopGoogleShoppingPackPay";
import {
  GOOGLE_SHOPPING_CREDIT_PACKS,
  type GoogleShoppingCreditPack,
} from "@/lib/google-shopping-credit-packs";
import type { ShopGoogleShoppingDashboardPayload } from "@/lib/shop-google-shopping-dashboard-payload";
import { shopGoogleShoppingPackPurchaseLabel } from "@/lib/shop-google-shopping";
import type { GoogleShoppingListingPicklistEntry } from "@/lib/shop-google-shopping-enrollment";

const btnPack =
  "inline-block rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100";
const btnPackSelected =
  "inline-block rounded-md border border-zinc-500/80 bg-zinc-800/70 px-2.5 py-1 text-[11px] font-medium text-zinc-100";

function GoogleShoppingAssignConfirmDialog(props: {
  titleId: string;
  listingLabels: string[];
  onDismiss: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { titleId, listingLabels, onDismiss, onConfirm, busy } = props;
  const n = listingLabels.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss, busy]);

  return (
    <div
      className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={busy ? undefined : onDismiss}
        disabled={busy}
      />
      <div className="relative z-[1] w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
        <h2 id={titleId} className="text-base font-semibold text-zinc-100">
          Confirm Google Shopping listings
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          You are about to submit {n} listing{n === 1 ? "" : "s"} to Google Merchant Center. This
          choice is permanent and cannot be changed later.
        </p>
        <ul className="mt-3 max-h-40 list-inside list-disc overflow-y-auto text-sm text-zinc-300">
          {listingLabels.map((label, i) => (
            <li key={`${i}-${label}`} className="truncate">
              {label}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded border border-zinc-600 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
            onClick={onDismiss}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border border-zinc-600 bg-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-300 disabled:opacity-50"
            onClick={onConfirm}
          >
            {busy ? "Submitting…" : "Confirm — lock in listings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopGoogleShoppingSection(props: {
  googleShopping: ShopGoogleShoppingDashboardPayload;
  stripePublishableKey?: string | null;
  mockListingFeeCheckout?: boolean;
  className?: string;
}) {
  const {
    googleShopping,
    stripePublishableKey = null,
    mockListingFeeCheckout = false,
    className = "mt-6 max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/30 p-2 sm:p-3",
  } = props;

  const router = useRouter();
  const confirmTitleId = useId();
  const [result, setResult] = useState<DashboardGoogleShoppingActionResult | null>(null);
  const [payPanelPack, setPayPanelPack] = useState<GoogleShoppingCreditPack | null>(null);
  const [payPanelVisible, setPayPanelVisible] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [picklistLoading, setPicklistLoading] = useState(false);
  const [picklistError, setPicklistError] = useState<string | null>(null);
  const [eligible, setEligible] = useState<GoogleShoppingListingPicklistEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);

  const credits = googleShopping.creditsAvailable;
  const maxSelect = Math.min(credits, eligible.length);

  useEffect(() => {
    setPayPanelVisible(payPanelPack !== null);
  }, [payPanelPack]);

  useEffect(() => {
    setResult(null);
    setPayPanelPack(null);
    setPayPanelVisible(false);
    setAssignOpen(false);
    setSelectedIds(new Set());
    setConfirmOpen(false);
  }, [googleShopping.creditsAvailable, googleShopping.enrolled.length]);

  const loadPicklist = useCallback(async () => {
    setPicklistLoading(true);
    setPicklistError(null);
    try {
      const res = await fetch("/api/dashboard/google-shopping/picklist");
      if (!res.ok) {
        setPicklistError("Could not load listings.");
        return;
      }
      const data = (await res.json()) as {
        eligible: GoogleShoppingListingPicklistEntry[];
      };
      setEligible(data.eligible ?? []);
    } catch {
      setPicklistError("Could not load listings.");
    } finally {
      setPicklistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    void loadPicklist();
  }, [assignOpen, loadPicklist]);

  function toggleListing(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= credits) return prev;
      next.add(id);
      return next;
    });
  }

  const selectedLabels = eligible
    .filter((e) => selectedIds.has(e.id))
    .map((e) => e.label);

  async function onConfirmAssign() {
    if (assignBusy || selectedIds.size === 0) return;
    setAssignBusy(true);
    setResult(null);
    try {
      const r = await assignGoogleShoppingListings([...selectedIds]);
      if (!r.ok) {
        setResult(r);
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      setAssignOpen(false);
      setSelectedIds(new Set());
      setResult({
        ok: true,
        enrolledCount: r.enrolledCount,
      });
      router.refresh();
    } finally {
      setAssignBusy(false);
    }
  }

  return (
    <section className={className}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/95">
        Off site searchability
      </h2>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
        Buy listing credits for Google Merchant Center, then choose which approved storefront listings
        to submit. Selections are permanent.
      </p>

      <p className="mt-2 text-[11px] text-zinc-400">
        <span className="font-medium text-zinc-200">{credits}</span> Google Shopping credit
        {credits === 1 ? "" : "s"} available
      </p>

      {result && !result.ok ? (
        <p className="mt-2 rounded border border-amber-900/50 bg-amber-950/25 px-2.5 py-1.5 text-xs text-amber-200/90">
          {result.error}
        </p>
      ) : null}
      {result && result.ok ? (
        <p className="mt-2 rounded border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-1.5 text-xs text-emerald-200/90">
          {result.enrolledCount != null
            ? `${result.enrolledCount} listing${result.enrolledCount === 1 ? "" : "s"} submitted to Google Shopping.`
            : "Credits added. Choose listings below to use them."}
        </p>
      ) : null}

      <div className="mt-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Credit packs</p>
        <ul className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
          {GOOGLE_SHOPPING_CREDIT_PACKS.map((pack) => (
            <li key={pack.id}>
              <button
                type="button"
                className={payPanelPack?.id === pack.id ? btnPackSelected : btnPack}
                onClick={() => {
                  setResult(null);
                  setPayPanelPack(pack);
                  setPayPanelVisible(true);
                }}
              >
                {pack.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {payPanelVisible && payPanelPack ? (
        <div className="mt-2 rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-3">
          <p className="text-sm font-medium text-zinc-200">
            {shopGoogleShoppingPackPurchaseLabel(payPanelPack.id)}
          </p>
          {mockListingFeeCheckout || stripePublishableKey?.trim() ? (
            <ShopGoogleShoppingPackPay
              pack={payPanelPack}
              stripePublishableKey={stripePublishableKey ?? ""}
              mockListingFeeCheckout={mockListingFeeCheckout}
              onPaid={() => {
                setPayPanelPack(null);
                setPayPanelVisible(false);
                setResult({ ok: true });
                router.refresh();
              }}
            />
          ) : (
            <p className="mt-3 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
              Stripe is not configured for card payments.
            </p>
          )}
          <button
            type="button"
            className="mt-3 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
            onClick={() => {
              setPayPanelPack(null);
              setPayPanelVisible(false);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {credits > 0 ? (
        <div className="mt-3">
          {!assignOpen ? (
            <button
              type="button"
              className={btnPack}
              onClick={() => {
                setResult(null);
                setAssignOpen(true);
              }}
            >
              Choose listings to submit…
            </button>
          ) : (
            <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-3">
              <p className="text-[11px] font-medium text-zinc-200">
                Select up to {maxSelect} listing{maxSelect === 1 ? "" : "s"} ({selectedIds.size}{" "}
                selected)
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Only approved listings visible on your storefront are eligible.
              </p>
              {picklistLoading ? (
                <p className="mt-2 text-xs text-zinc-500">Loading listings…</p>
              ) : picklistError ? (
                <p className="mt-2 text-xs text-amber-300/90">{picklistError}</p>
              ) : eligible.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  No eligible listings. Publish approved listings on your storefront first.
                </p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {eligible.map((row) => {
                    const checked = selectedIds.has(row.id);
                    const disabled = !checked && selectedIds.size >= credits;
                    return (
                      <li key={row.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                            checked
                              ? "border-emerald-900/50 bg-emerald-950/20 text-zinc-200"
                              : "border-zinc-800 bg-zinc-950/40 text-zinc-400"
                          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-zinc-600"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleListing(row.id)}
                          />
                          <span className="min-w-0 truncate">{row.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-600 bg-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={selectedIds.size === 0 || picklistLoading}
                  onClick={() => setConfirmOpen(true)}
                >
                  Review & confirm
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
                  onClick={() => {
                    setAssignOpen(false);
                    setSelectedIds(new Set());
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {googleShopping.enrolled.length > 0 ? (
        <details className="group mt-4 rounded-xl border border-zinc-800 bg-zinc-950/25">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-400 [&::-webkit-details-marker]:hidden">
            <span>
              Enrolled in Google Shopping
              <span className="ml-1.5 font-normal normal-case tabular-nums text-zinc-600">
                ({googleShopping.enrolled.length})
              </span>
            </span>
            <span className="text-[10px] font-normal normal-case text-zinc-600 group-open:hidden">
              Expand
            </span>
          </summary>
          <div className="border-t border-zinc-800/80 px-3 pb-3 pt-2">
            <ul className="space-y-1">
              {googleShopping.enrolled.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5 text-[11px]"
                >
                  <span className="min-w-0 truncate text-zinc-300">{row.label}</span>
                  <span className="shrink-0 text-zinc-600">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                      new Date(row.enrolledAtIso),
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-zinc-600">
              Google Merchant Center screens each listing. Processing can take up to a week.
            </p>
          </div>
        </details>
      ) : null}

      {confirmOpen ? (
        <GoogleShoppingAssignConfirmDialog
          titleId={confirmTitleId}
          listingLabels={selectedLabels}
          busy={assignBusy}
          onDismiss={() => setConfirmOpen(false)}
          onConfirm={() => void onConfirmAssign()}
        />
      ) : null}
    </section>
  );
}
