import { PromotionKind } from "@/generated/prisma/enums";
import { PromotionsCheckoutSpinner } from "@/components/dashboard/PromotionsCheckoutSpinner";
import { promotionKindLabel } from "@/lib/promotions";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Summary above pay — cost shows a spinner while placement pricing loads. */
export function PromotionCheckoutCostLine(props: {
  kind: PromotionKind;
  amountCents: number | null;
  loading?: boolean;
}) {
  const { kind, amountCents, loading = false } = props;

  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-400">
      <strong className="text-zinc-200">{promotionKindLabel(kind)}</strong>
      <span aria-hidden>—</span>
      <span className="inline-flex items-center gap-1.5">
        {loading ? (
          <>
            <PromotionsCheckoutSpinner />
            <span className="text-zinc-500">Calculating price…</span>
          </>
        ) : amountCents != null ? (
          <strong className="text-zinc-200">{formatMoney(amountCents)}</strong>
        ) : null}
      </span>
    </p>
  );
}
