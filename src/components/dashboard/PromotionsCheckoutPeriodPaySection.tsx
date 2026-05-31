"use client";

import { PromotionKind } from "@/generated/prisma/enums";
import { PromotionCheckoutCostLine } from "@/components/dashboard/PromotionCheckoutCostLine";
import { PromotionsCheckoutPayLazy } from "@/components/dashboard/PromotionsCheckoutPayLazy";
import { PromotionsCheckoutPeriodFieldset } from "@/components/dashboard/promotions/PromotionsCheckoutPeriodFieldset";
import { computedPeriodChoice } from "@/lib/promotion-checkout-period-display";
import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** In-tab checkout — static period hints until click; then Pacific window + proration. */
export function PromotionsCheckoutPeriodPaySection(props: {
  kind: PlacementCheckoutPromotionKind;
  selectedOffset: 0 | 1 | 2 | null;
  computedPeriodChoices: PlacementPeriodChoiceUi[] | null;
  mockPromotionCheckout: boolean;
  stripePublishableKey: string;
  promotionCreditsAvailable?: number;
  onSelectPeriod: (offset: 0 | 1 | 2) => void;
  loadingOffset?: 0 | 1 | 2 | null;
  periodPricingLoading?: boolean;
}) {
  const {
    kind,
    selectedOffset,
    computedPeriodChoices,
    mockPromotionCheckout,
    onSelectPeriod,
    loadingOffset = null,
    periodPricingLoading = false,
  } = props;
  const computed = selectedOffset != null && computedPeriodChoices != null;
  const selected =
    computed && selectedOffset != null
      ? computedPeriodChoice(computedPeriodChoices, selectedOffset)
      : undefined;

  const showCostLoading =
    periodPricingLoading || (selectedOffset != null && !computed);

  return (
    <>
      <PromotionsCheckoutPeriodFieldset
        kind={kind}
        selectedOffset={selectedOffset}
        computedPeriodChoices={computedPeriodChoices}
        loadingOffset={loadingOffset}
        onSelectPeriod={onSelectPeriod}
      />

      {showCostLoading ? (
        <PromotionCheckoutCostLine
          kind={kind as PromotionKind}
          amountCents={null}
          loading
        />
      ) : selected?.selectable ? (
        <PromotionsCheckoutPayLazy
          kind={kind as PromotionKind}
          placementOffset={selectedOffset!}
          amountCents={selected.amountCents}
          mockPay={mockPromotionCheckout}
          stripePublishableKey={props.stripePublishableKey}
          promotionCreditsAvailable={props.promotionCreditsAvailable}
        />
      ) : computed && selected && !selected.selectable ? (
        <p className="mt-3 text-xs text-amber-200/90">
          {selected.disabledReason ?? "This period is not available."}
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-500">Choose a placement period to see dates and pricing.</p>
      )}
    </>
  );
}
