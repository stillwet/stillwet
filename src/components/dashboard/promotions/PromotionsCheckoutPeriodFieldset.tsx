"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PromotionsCheckoutSpinner } from "@/components/dashboard/PromotionsCheckoutSpinner";
import {
  formatComputedPeriodChoiceLine,
  staticPromotionPeriodPickerRows,
} from "@/lib/promotion-checkout-period-display";
import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

const periodRowClass = (active: boolean, loading: boolean) =>
  `flex w-full items-start gap-2 rounded px-0.5 text-left text-[11px] ${
    loading ? "text-violet-100/90" : active ? "text-violet-100" : "text-zinc-300 hover:text-zinc-100"
  }`;

function PeriodRadioDot({ active, loading }: { active: boolean; loading?: boolean }) {
  if (loading) {
    return <PromotionsCheckoutSpinner className="mt-0.5 shrink-0" />;
  }
  return (
    <span
      className={`mt-0.5 inline-block size-3.5 shrink-0 rounded-full border ${
        active ? "border-violet-500 bg-violet-600/80" : "border-zinc-600 bg-zinc-900"
      }`}
      aria-hidden
    />
  );
}

/** Period picker — spinner replaces the radio dot on the row being loaded. */
export function PromotionsCheckoutPeriodFieldset(props: {
  kind: PlacementCheckoutPromotionKind;
  selectedOffset: 0 | 1 | 2 | null;
  computedPeriodChoices: PlacementPeriodChoiceUi[] | null;
  loadingOffset?: 0 | 1 | 2 | null;
  getPeriodHref?: (offset: 0 | 1 | 2) => string;
  onSelectPeriod?: (offset: 0 | 1 | 2) => void;
  onNavigatePeriod?: (offset: 0 | 1 | 2, href: string) => void;
}) {
  const {
    kind,
    selectedOffset,
    computedPeriodChoices,
    loadingOffset = null,
    getPeriodHref,
    onSelectPeriod,
    onNavigatePeriod,
  } = props;
  const computed = selectedOffset != null && computedPeriodChoices != null;

  function renderSelectableRow(offset: 0 | 1 | 2, active: boolean, label: ReactNode) {
    const loading = loadingOffset === offset;

    if (onSelectPeriod) {
      return (
        <button
          key={offset}
          type="button"
          disabled={loading}
          onClick={() => onSelectPeriod(offset)}
          aria-current={active ? "true" : undefined}
          aria-busy={loading || undefined}
          className={periodRowClass(active, loading)}
        >
          <PeriodRadioDot active={active} loading={loading} />
          {label}
        </button>
      );
    }

    const href = getPeriodHref?.(offset);
    if (!href) return null;

    return (
      <Link
        key={offset}
        href={href}
        scroll={false}
        prefetch={false}
        aria-current={active ? "true" : undefined}
        aria-busy={loading || undefined}
        className={periodRowClass(active, loading)}
        onClick={(e) => {
          if (!onNavigatePeriod) return;
          e.preventDefault();
          onNavigatePeriod(offset, href);
        }}
      >
        <PeriodRadioDot active={active} loading={loading} />
        {label}
      </Link>
    );
  }

  return (
    <fieldset className="mt-3 space-y-1.5 rounded-md border border-zinc-800/80 p-2">
      <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Placement period
      </legend>
      <div className="flex flex-col gap-1.5">
        {computed
          ? computedPeriodChoices!.map((c) => {
              const offset = Number(c.offset) as 0 | 1 | 2;
              const active = selectedOffset === offset;
              const labelBody = (
                <span className="font-medium text-zinc-200">{formatComputedPeriodChoiceLine(c)}</span>
              );

              if (!c.selectable) {
                return (
                  <div
                    key={offset}
                    className="flex items-start gap-2 text-[11px] text-zinc-600"
                    aria-disabled="true"
                  >
                    <PeriodRadioDot active={false} />
                    <span>
                      {labelBody}
                      {c.disabledReason ? (
                        <span className="block text-zinc-600"> — {c.disabledReason}</span>
                      ) : null}
                    </span>
                  </div>
                );
              }

              return renderSelectableRow(offset, active, labelBody);
            })
          : staticPromotionPeriodPickerRows(kind).map((row) =>
              renderSelectableRow(
                row.offset,
                false,
                <span>
                  <span className="font-medium text-zinc-200">{row.periodName}</span>
                  {" — "}
                  <span className="text-zinc-400">{row.priceLine}</span>
                </span>,
              ),
            )}
      </div>
    </fieldset>
  );
}
