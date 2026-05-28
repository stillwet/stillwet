import type { ReactNode } from "react";
import Link from "next/link";
import {
  dashboardPromotionsBuyUrl,
} from "@/lib/dashboard-promotions-path";
import { PROMOTION_KIND_LOAD_ORDER } from "@/lib/promotion-kind-load-order";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";
import { promotionKindLabel, promotionPriceCentsForKind } from "@/lib/promotions";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Static picker (server HTML) — links open checkout via `?buy=`; no client picker chunk. */
export function PromotionsPickerShell(props: {
  selectedKind?: PlacementCheckoutPromotionKind | null;
  queryPreserve?: Record<string, string | undefined>;
  /** Renders under the active kind button (replaces the static blurb). */
  activeCheckout?: ReactNode;
}) {
  const selectedKind = props.selectedKind ?? null;
  const queryPreserve = props.queryPreserve;
  const activeCheckout = props.activeCheckout;

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Add promotion</p>
      <ul className="flex flex-col gap-3">
        {PROMOTION_KIND_LOAD_ORDER.map((kind) => {
          const active = selectedKind === kind;
          return (
            <li key={kind} className="flex w-full min-w-0 flex-col">
              <Link
                href={dashboardPromotionsBuyUrl(kind, selectedKind, queryPreserve)}
                prefetch={false}
                scroll={false}
                className={`block w-full rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  active
                    ? "border-violet-500/70 bg-violet-950/40 text-violet-100"
                    : "border-zinc-700 bg-zinc-950/50 text-zinc-200 hover:border-zinc-500"
                }`}
              >
                <span className="block">{promotionKindLabel(kind)}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                  from {formatMoney(promotionPriceCentsForKind(kind))}
                </span>
              </Link>
              {active && activeCheckout != null ? (
                <div className="mt-2 min-w-0">{activeCheckout}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
