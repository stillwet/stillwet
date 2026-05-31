"use client";

import { useCallback, useEffect, useState } from "react";
import { PromotionsCheckoutHeader } from "@/components/dashboard/PromotionsCheckoutHeader";
import { PromotionsCheckoutPeriodPayLazy } from "@/components/dashboard/PromotionsCheckoutPeriodPayLazy";
import {
  getPlacementPeriodChoicesForKind,
  schedulePlacementPeriodCalendarPrefetch,
} from "@/lib/promotion-period-calendar-cache";
import { usePreserveScrollOnSettled } from "@/lib/use-preserve-scroll-on-settled";
import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** In-dashboard checkout — static-then-compute period flow with loading feedback on click. */
export function PromotionsInlineCheckout(props: {
  kind: PlacementCheckoutPromotionKind;
  mockPromotionCheckout: boolean;
  stripePublishableKey: string;
  promotionCreditsAvailable?: number;
  onClose: () => void;
}) {
  const { kind, mockPromotionCheckout, stripePublishableKey, promotionCreditsAvailable, onClose } = props;
  const [selectedOffset, setSelectedOffset] = useState<0 | 1 | 2 | null>(null);
  const [computedPeriodChoices, setComputedPeriodChoices] = useState<PlacementPeriodChoiceUi[] | null>(
    null,
  );

  useEffect(() => {
    setSelectedOffset(null);
    setComputedPeriodChoices(null);
    schedulePlacementPeriodCalendarPrefetch();
  }, [kind]);

  useEffect(() => {
    if (selectedOffset == null) {
      setComputedPeriodChoices(null);
      return;
    }
    setComputedPeriodChoices(null);
    const frame = requestAnimationFrame(() => {
      setComputedPeriodChoices(getPlacementPeriodChoicesForKind(kind));
    });
    return () => cancelAnimationFrame(frame);
  }, [kind, selectedOffset]);

  const periodPricingLoading = selectedOffset != null && computedPeriodChoices == null;
  const pricingReady = selectedOffset != null && computedPeriodChoices != null;
  const captureScroll = usePreserveScrollOnSettled(periodPricingLoading, pricingReady);

  const onSelectPeriod = useCallback(
    (offset: 0 | 1 | 2) => {
      captureScroll();
      setSelectedOffset(offset);
    },
    [captureScroll],
  );

  return (
    <div className="mt-2 w-full rounded-lg border border-violet-900/35 bg-zinc-950/50 p-4">
      <PromotionsCheckoutHeader kind={kind} onCancel={onClose} />
      <PromotionsCheckoutPeriodPayLazy
        kind={kind}
        selectedOffset={selectedOffset}
        computedPeriodChoices={computedPeriodChoices}
        mockPromotionCheckout={mockPromotionCheckout}
        stripePublishableKey={stripePublishableKey}
        promotionCreditsAvailable={promotionCreditsAvailable}
        onSelectPeriod={onSelectPeriod}
        loadingOffset={periodPricingLoading ? selectedOffset : null}
        periodPricingLoading={periodPricingLoading}
      />
    </div>
  );
}
