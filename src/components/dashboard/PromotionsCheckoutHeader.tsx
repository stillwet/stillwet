import Link from "next/link";
import { dashboardPromotionsBuyUrl } from "@/lib/dashboard-promotions-path";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";
import { PromotionKindSurfaceBlurb } from "@/components/dashboard/PromotionKindSurfaceBlurb";
import { promotionKindLabel } from "@/lib/promotions";

/** Checkout step 1 — title, placement summary, cancel. */
export function PromotionsCheckoutHeader(props: {
  kind: PlacementCheckoutPromotionKind;
  queryPreserve?: Record<string, string | undefined>;
  onCancel?: () => void;
}) {
  const { kind, queryPreserve, onCancel } = props;

  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800/90 pb-3">
      <div>
        <h3 className="text-sm font-medium text-zinc-100">{promotionKindLabel(kind)}</h3>
        <div className="mt-1 space-y-1 text-[11px] leading-snug text-zinc-500">
          <PromotionKindSurfaceBlurb kind={kind} />
        </div>
      </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            Cancel
          </button>
        ) : (
          <Link
            href={dashboardPromotionsBuyUrl(kind, kind, queryPreserve)}
            scroll={false}
            prefetch={false}
            className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            Cancel
          </Link>
        )}
    </div>
  );
}
