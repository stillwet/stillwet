import { PromotionsCheckoutHeader } from "@/components/dashboard/PromotionsCheckoutHeader";
import { PromotionsCheckoutBody } from "@/components/dashboard/promotions/PromotionsCheckoutBody";
import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** Checkout panel — period rows + pay with click loading feedback. */
export function PromotionsCheckoutShell(props: {
  kind: PlacementCheckoutPromotionKind;
  selectedOffset: 0 | 1 | 2 | null;
  computedPeriodChoices: PlacementPeriodChoiceUi[] | null;
  mockPromotionCheckout: boolean;
  queryPreserve?: Record<string, string | undefined>;
}) {
  return (
    <div className="w-full rounded-lg border border-violet-900/35 bg-zinc-950/50 p-4">
      <PromotionsCheckoutHeader kind={props.kind} queryPreserve={props.queryPreserve} />
      <PromotionsCheckoutBody {...props} />
    </div>
  );
}
