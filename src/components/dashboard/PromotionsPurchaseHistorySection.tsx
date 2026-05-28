"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PromotionKind } from "@/generated/prisma/enums";
import type {
  DashboardPromotionsTabSummaryPayload,
  PromotionPurchaseLifecycle,
} from "@/lib/dashboard-promotions-tab-types";
import {
  parsePromotionKind,
  promotionKindLabel,
  promotionKindSurfaceDescription,
} from "@/lib/promotions";
import {
  isShopFlairPurchaseHistoryRow,
  shopFlairPurchaseHistoryLabel,
} from "@/lib/shop-flair";
import {
  isShopGoogleShoppingPurchaseHistoryRow,
  shopGoogleShoppingPurchaseHistoryLabel,
} from "@/lib/shop-google-shopping";
import type { PromotionPurchaseSummaryRow } from "@/lib/dashboard-promotions-tab-types";

function lifecycleShortLabel(l: PromotionPurchaseLifecycle): string {
  switch (l) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "scheduled":
      return "Scheduled";
    case "pending_payment":
      return "Pending payment";
    default:
      return "Other";
  }
}

function formatPaidDateMdYy(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch {
    return iso;
  }
}

function fallbackExpiresMmDdFromPacificRange(range: string | null | undefined): string | null {
  if (!range) return null;
  const m = range.match(/^(\d{2}\/\d{2})–(\d{2}\/\d{2})$/);
  return m?.[2] ?? null;
}

function formatExpiresLabel(p: {
  expiresAtIso?: string | null;
  activeWindowPacificRange?: string | null;
  kind: string;
  purchaseType?: string;
  lifecycle: PromotionPurchaseLifecycle;
}): string {
  if (isShopFlairPurchaseHistoryRow(p)) {
    return p.lifecycle === "active" ? "lifetime access" : "—";
  }
  if (isShopGoogleShoppingPurchaseHistoryRow(p)) {
    return p.lifecycle === "active" ? "credits granted" : "—";
  }
  const iso = p.expiresAtIso;
  if (iso) return `expires ${formatPaidDateMdYy(iso)}`;
  const mmdd = fallbackExpiresMmDdFromPacificRange(p.activeWindowPacificRange);
  if (mmdd) return `expires ${mmdd}`;
  return "expires —";
}

function purchaseHistoryTitle(p: PromotionPurchaseSummaryRow): string {
  if (isShopFlairPurchaseHistoryRow(p)) return shopFlairPurchaseHistoryLabel();
  if (isShopGoogleShoppingPurchaseHistoryRow(p)) {
    return shopGoogleShoppingPurchaseHistoryLabel({
      packId: p.googleShoppingPackId,
      creditsGranted: p.googleShoppingCreditsGranted,
    });
  }
  const ke = parsePromotionKind(p.kind) ?? PromotionKind.FRONT_PAGE_ITEM;
  return promotionKindLabel(ke);
}

function purchaseHistoryScopeSuffix(p: PromotionPurchaseSummaryRow): string {
  if (isShopFlairPurchaseHistoryRow(p) || isShopGoogleShoppingPurchaseHistoryRow(p)) return "";
  const ke = parsePromotionKind(p.kind) ?? PromotionKind.FRONT_PAGE_ITEM;
  if (ke !== PromotionKind.FEATURED_SHOP_HOME && p.listingLabel) return ` — ${p.listingLabel}`;
  if (ke !== PromotionKind.FEATURED_SHOP_HOME) return " — listing pending";
  return " — shop";
}

type PromotionsPurchaseHistorySectionProps = {
  /** When true, render inner content only (parent owns the &lt;details&gt; shell). */
  embedded?: boolean;
  /** When embedded, fetch history as soon as this chunk mounts. */
  autoLoad?: boolean;
};

/** Loads purchase history from the API only after the creator expands this section. */
export function PromotionsPurchaseHistorySection({
  embedded = false,
  autoLoad = false,
}: PromotionsPurchaseHistorySectionProps = {}) {
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<DashboardPromotionsTabSummaryPayload["purchases"]>([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");

  const loadHistory = useCallback(() => {
    if (loadedRef.current || loading) return;
    setLoading(true);
    setError(null);
    void fetch("/api/dashboard/promotions", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<DashboardPromotionsTabSummaryPayload>;
      })
      .then((data) => {
        setPurchases(data.purchases ?? []);
        loadedRef.current = true;
      })
      .catch(() => {
        setError("Could not load purchase history. Try again.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loading]);

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open) loadHistory();
  };

  useEffect(() => {
    if (embedded && autoLoad) loadHistory();
  }, [embedded, autoLoad, loadHistory]);

  const activePurchases = purchases.filter((p) => p.lifecycle === "active" || p.lifecycle === "scheduled");
  const expiredPurchases = purchases.filter((p) => p.lifecycle === "expired");
  const otherPurchases = purchases.filter(
    (p) => p.lifecycle !== "active" && p.lifecycle !== "scheduled" && p.lifecycle !== "expired",
  );
  const selectedPurchase = purchases.find((p) => p.id === selectedPurchaseId) ?? null;

  const panel = (
    <div className={embedded ? undefined : "border-t border-zinc-800/80 px-4 pb-4 pt-3"}>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
              aria-hidden
            />
            Loading history…
          </p>
        ) : error ? (
          <div className="space-y-2 text-sm text-amber-200/90">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                loadedRef.current = false;
                loadHistory();
              }}
              className="rounded border border-amber-700/50 px-2 py-1 text-xs hover:border-amber-500/60"
            >
              Retry
            </button>
          </div>
        ) : loadedRef.current && purchases.length === 0 ? (
          <p className="text-sm text-zinc-500">No purchases yet.</p>
        ) : loadedRef.current ? (
          <>
            <label
              className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500"
              htmlFor="promotions-history-select"
            >
              Purchases
            </label>
            <select
              id="promotions-history-select"
              value={selectedPurchaseId}
              onChange={(e) => setSelectedPurchaseId(e.target.value)}
              className="mt-2 w-full max-w-xl rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"
            >
              <option value="">Browse history (active / expired)…</option>
              {activePurchases.length > 0 ? (
                <optgroup label="Active / scheduled">
                  {activePurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {purchaseHistoryTitle(p)}
                      {purchaseHistoryScopeSuffix(p)} · {formatExpiresLabel(p)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {expiredPurchases.length > 0 ? (
                <optgroup label="Expired">
                  {expiredPurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {purchaseHistoryTitle(p)}
                      {purchaseHistoryScopeSuffix(p)} · {formatExpiresLabel(p)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {otherPurchases.length > 0 ? (
                <optgroup label="Other">
                  {otherPurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {lifecycleShortLabel(p.lifecycle)} · {purchaseHistoryTitle(p)}
                      {purchaseHistoryScopeSuffix(p)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            {selectedPurchase ? (
              <div className="mt-3 rounded-md border border-zinc-800/90 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-300">
                <p className="font-medium text-zinc-200">
                  {purchaseHistoryTitle(selectedPurchase)}
                  <span
                    className={`ml-2 text-[10px] font-normal uppercase tracking-wide ${
                      selectedPurchase.lifecycle === "active" ? "text-blue-400" : "text-zinc-500"
                    }`}
                  >
                    {lifecycleShortLabel(selectedPurchase.lifecycle)}
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                  {isShopFlairPurchaseHistoryRow(selectedPurchase) ? (
                    <>
                      One-time purchase unlocking flair badge selection on your storefront and on the{" "}
                      <Link href="/shops" className="text-zinc-300 underline underline-offset-2 hover:text-zinc-200">
                        All shops
                      </Link>{" "}
                      page.
                    </>
                  ) : isShopGoogleShoppingPurchaseHistoryRow(selectedPurchase) ? (
                    <>
                      One-time purchase enrolling your shop in the platform Google Merchant Center product
                      feed (operated by Still Wet).
                    </>
                  ) : (
                    (() => {
                      const kind = parsePromotionKind(selectedPurchase.kind) ?? PromotionKind.FRONT_PAGE_ITEM;
                      if (kind === PromotionKind.HOT_FEATURED_ITEM) {
                        return (
                          <>
                            Displays as a &quot;Hot Item&quot; on the{" "}
                            <Link
                              href="/shop/all"
                              className="text-zinc-300 underline underline-offset-2 hover:text-zinc-200"
                            >
                              all items
                            </Link>{" "}
                            page carousel.
                          </>
                        );
                      }
                      if (kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM) {
                        return (
                          <>
                            Displays first under the &quot;Popular&quot; filter on the{" "}
                            <Link
                              href="/shop/all"
                              className="text-zinc-300 underline underline-offset-2 hover:text-zinc-200"
                            >
                              all items
                            </Link>{" "}
                            page.
                          </>
                        );
                      }
                      return promotionKindSurfaceDescription(kind);
                    })()
                  )}
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
                  {isShopFlairPurchaseHistoryRow(selectedPurchase) ? (
                    <li>Access: lifetime (change flair type anytime in Shop profile or Shop Upgrades)</li>
                  ) : isShopGoogleShoppingPurchaseHistoryRow(selectedPurchase) ? (
                    <li>Access: lifetime (eligible listings included on platform feed refresh)</li>
                  ) : (
                    <>
                      {selectedPurchase.listingLabel ? (
                        <li>
                          Listing: <span className="text-zinc-300">{selectedPurchase.listingLabel}</span>
                        </li>
                      ) : parsePromotionKind(selectedPurchase.kind) !== PromotionKind.FEATURED_SHOP_HOME ? (
                        <li>Listing: not assigned yet</li>
                      ) : null}
                      {selectedPurchase.activeWindowPacificRange ? (
                        <li>Window: {selectedPurchase.activeWindowPacificRange}</li>
                      ) : null}
                    </>
                  )}
                  <li>
                    Purchased: {selectedPurchase.paidAtIso ? formatPaidDateMdYy(selectedPurchase.paidAtIso) : "—"}
                  </li>
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
    </div>
  );

  if (embedded) return panel;

  return (
    <details className="group mt-6 rounded-xl border border-zinc-800 bg-zinc-950/25" onToggle={onToggle}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Purchase history
        </span>
        <span className="text-[10px] text-zinc-600" aria-hidden>
          Expand
          <span className="ml-1 inline-block transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      {panel}
    </details>
  );
}
