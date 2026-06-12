"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { dashboardSetShopFlairType, type DashboardFlairActionResult } from "@/actions/dashboard-flair";
import { ShopFlairAccessPay } from "@/components/dashboard/ShopFlairAccessPay";
import type { ShopFlairDashboardPayload } from "@/lib/shop-flair-dashboard-payload";
import { shopFlairAccessBuyButtonLabel, shopFlairAccessPurchaseLabel } from "@/lib/shop-flair";

const btnPack =
  "inline-block rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100";
const btnPackSelected =
  "inline-block rounded-md border border-zinc-500/80 bg-zinc-800/70 px-2.5 py-1 text-[11px] font-medium text-zinc-100";

/** Native `<select>` popup — `[color-scheme:dark]` keeps the option list dark on Windows Chromium/Edge. */
const flairSelectClass =
  "mt-1 block w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none [color-scheme:dark] disabled:cursor-not-allowed disabled:opacity-50";
const flairSelectClassCompact =
  "mt-1 block w-full cursor-pointer rounded border border-zinc-700 bg-zinc-950/40 px-2 py-1.5 text-xs text-zinc-100 outline-none [color-scheme:dark] disabled:cursor-not-allowed disabled:opacity-50";

export function ShopFlairSection(props: {
  flair: ShopFlairDashboardPayload;
  stripePublishableKey?: string | null;
  mockListingFeeCheckout?: boolean;
  className?: string;
  /** Profile form: flair type picker only when access is already unlocked. */
  variant?: "full" | "selection";
}) {
  const {
    flair,
    stripePublishableKey = null,
    mockListingFeeCheckout = false,
    className = "mt-6 max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/30 p-2 sm:p-3",
    variant = "full",
  } = props;

  const router = useRouter();
  const [flairResult, setFlairResult] = useState<DashboardFlairActionResult | null>(null);
  const [isFlairPending, startFlairTransition] = useTransition();
  const [selectedFlairTypeId, setSelectedFlairTypeId] = useState(flair.selectedType?.id ?? "");
  const [flairPayOpen, setFlairPayOpen] = useState(false);
  const [flairSuccessKind, setFlairSuccessKind] = useState<"purchase" | null>(null);

  useEffect(() => {
    setFlairResult(null);
    setFlairSuccessKind(null);
    setSelectedFlairTypeId(flair.selectedType?.id ?? "");
    setFlairPayOpen(false);
  }, [flair.purchasedAt, flair.selectedType?.id]);

  const saveFlairSelection = (nextFlairTypeId: string) => {
    const savedId = flair.selectedType?.id ?? "";
    if (nextFlairTypeId === savedId || isFlairPending) return;

    setSelectedFlairTypeId(nextFlairTypeId);
    setFlairResult(null);
    const fd = new FormData();
    fd.set("flairTypeId", nextFlairTypeId);
    startFlairTransition(async () => {
      const r = await dashboardSetShopFlairType(fd);
      setFlairResult(r);
      if (r.ok) router.refresh();
    });
  };

  if (variant === "selection") {
    if (!flair.purchasedAt) {
      return (
        <div className={className}>
          <div className="pointer-events-none select-none opacity-45" aria-disabled="true">
            <label className="block text-xs text-zinc-500">
              Shop flair
              <select
                disabled
                value="locked"
                tabIndex={-1}
                className={`${flairSelectClass} cursor-not-allowed border-zinc-800 bg-zinc-950/70 text-zinc-600`}
              >
                <option value="locked">Purchase flair access on Shop upgrades to unlock.</option>
              </select>
            </label>
          </div>
        </div>
      );
    }

    return (
      <div className={className}>
        <label className="block text-xs text-zinc-500">
          Shop flair
          <select
            value={selectedFlairTypeId}
            onChange={(e) => saveFlairSelection(e.target.value)}
            disabled={isFlairPending}
            className={flairSelectClass}
          >
            <option value="">None</option>
            {flair.catalog.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {flairResult && !flairResult.ok ? (
          <p className="mt-2 text-xs leading-snug text-red-300/90" role="alert">
            {flairResult.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className={className}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-100">Shop flair</h2>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
        Optional badge on your storefront and the{" "}
        <Link
          href="/shops"
          prefetch={false}
          className="font-medium text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400"
        >
          All shops
        </Link>{" "}
        page. Flairs can be changed anytime after purchase.
      </p>

      {flair.purchasedAt ? (
        <p className="mt-2 text-[11px] text-zinc-400">
          Current flair:{" "}
          <span className="font-medium text-zinc-200">
            {flair.selectedType?.label ?? "None selected"}
          </span>
        </p>
      ) : null}

      {flairResult && !flairResult.ok ? (
        <p className="mt-2 rounded border border-amber-900/50 bg-amber-950/25 px-2.5 py-1.5 text-xs text-amber-200/90">
          {flairResult.error}
        </p>
      ) : null}
      {flairResult && flairResult.ok && flairSuccessKind === "purchase" ? (
        <p className="mt-2 rounded border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-1.5 text-xs text-emerald-200/90">
          Flair access purchased. Choose a flair below.
        </p>
      ) : null}

      {!flair.purchasedAt ? (
        <>
          <div className="mt-3">
            <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
              <li>
                <button
                  type="button"
                  className={flairPayOpen ? btnPackSelected : btnPack}
                  onClick={() => {
                    setFlairResult(null);
                    setFlairPayOpen(true);
                  }}
                >
                  {shopFlairAccessBuyButtonLabel()}
                </button>
              </li>
            </ul>
          </div>

          {flair.catalog.types.length > 0 ? (
            <div className="mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Available flair types
              </p>
              <ul className="mt-1.5 flex flex-row flex-wrap gap-1">
                {flair.catalog.types.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 py-1 text-[11px] text-zinc-400"
                  >
                    {t.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {flairPayOpen ? (
            <div className="mt-2 rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-3">
              <p className="text-sm font-medium text-zinc-200">{shopFlairAccessPurchaseLabel()}</p>
              {mockListingFeeCheckout || stripePublishableKey?.trim() ? (
                <ShopFlairAccessPay
                  stripePublishableKey={stripePublishableKey ?? ""}
                  mockListingFeeCheckout={mockListingFeeCheckout}
                  onPaid={() => {
                    setFlairPayOpen(false);
                    setFlairSuccessKind("purchase");
                    setFlairResult({ ok: true });
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
                onClick={() => setFlairPayOpen(false)}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-3 rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-3">
          <label className="block text-[11px] font-medium text-zinc-200">
            Choose a flair type
            <select
              value={selectedFlairTypeId}
              onChange={(e) => saveFlairSelection(e.target.value)}
              disabled={isFlairPending}
              className={flairSelectClassCompact}
            >
              <option value="">None</option>
              {flair.catalog.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
