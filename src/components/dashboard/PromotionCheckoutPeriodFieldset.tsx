"use client";

import { memo } from "react";
import { PROMOTION_DEFERRED_NEXT_TIER_PRICE_MULTIPLIER } from "@/lib/promotion-policy-shared";
import type { PromotionMonthlySlotUi } from "@/lib/promotion-dashboard-ui-types";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Lightweight period picker — no Stripe or server actions (safe to mount on button click). */
export const PromotionCheckoutPeriodFieldset = memo(function PromotionCheckoutPeriodFieldset(props: {
  slotUi: PromotionMonthlySlotUi;
  placementOffset: 0 | 1 | 2;
  setPlacementOffset: (o: 0 | 1 | 2) => void;
  radioName?: string;
}) {
  const { slotUi, placementOffset, setPlacementOffset, radioName = "promotion-placement" } = props;

  return (
    <fieldset className="space-y-1.5 rounded-md border border-zinc-800/80 p-2">
      <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Placement period
      </legend>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Placement period">
        {slotUi.periodChoices.map((c) => {
          const offset = Number(c.offset) as 0 | 1 | 2;
          const labelBody = (
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
          );

          if (!c.selectable) {
            return (
              <div
                key={offset}
                className="flex items-start gap-2 text-[11px] text-zinc-600"
                aria-disabled="true"
              >
                <span className="mt-0.5 inline-block size-3.5 shrink-0 rounded-full border border-zinc-700 bg-zinc-900/80" />
                {labelBody}
              </div>
            );
          }

          return (
            <label
              key={offset}
              className="flex cursor-pointer items-start gap-2 text-[11px] text-zinc-300"
            >
              <input
                type="radio"
                name={radioName}
                value={String(offset)}
                checked={placementOffset === offset}
                onChange={() => setPlacementOffset(offset)}
                className="mt-0.5"
              />
              {labelBody}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
});
