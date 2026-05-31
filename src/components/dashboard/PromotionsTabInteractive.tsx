"use client";

import { useState } from "react";
import { PromotionsInlineCheckout } from "@/components/dashboard/PromotionsInlineCheckout";
import { PROMOTION_KIND_LOAD_ORDER } from "@/lib/promotion-kind-load-order";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";
import type { DashboardPromotionsTabSummaryPayload } from "@/lib/dashboard-promotions-tab-types";
import { promotionKindLabel, promotionPriceCentsForKind } from "@/lib/promotions";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export type PromotionsTabInteractiveProps = {
  initialSummary: DashboardPromotionsTabSummaryPayload;
};

export function PromotionsTabInteractive({ initialSummary }: PromotionsTabInteractiveProps) {
  const [checkoutKind, setCheckoutKind] = useState<PlacementCheckoutPromotionKind | null>(null);

  return (
    <>
      <div className="space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Add promotion</p>
        <ul className="flex flex-col gap-3">
          {PROMOTION_KIND_LOAD_ORDER.map((kind) => {
            const active = checkoutKind === kind;
            return (
              <li key={kind} className="flex w-full min-w-0 flex-col">
                <button
                  type="button"
                  onClick={() => setCheckoutKind((k) => (k === kind ? null : kind))}
                  className={`w-full rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    active
                      ? "border-violet-500/70 bg-violet-950/40 text-violet-100"
                      : "border-zinc-700 bg-zinc-950/50 text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  <span className="block">{promotionKindLabel(kind)}</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                    from {formatMoney(promotionPriceCentsForKind(kind))}
                  </span>
                </button>
                {active ? (
                  <PromotionsInlineCheckout
                    kind={kind}
                    mockPromotionCheckout={initialSummary.mockPromotionCheckout}
                    stripePublishableKey={initialSummary.stripePublishableKey ?? ""}
                    promotionCreditsAvailable={initialSummary.promotionCreditBalances?.[kind] ?? 0}
                    onClose={() => setCheckoutKind(null)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
