"use client";

import { usePreserveScrollOnSettled } from "@/lib/use-preserve-scroll-on-settled";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PromotionCheckoutCostLine } from "@/components/dashboard/PromotionCheckoutCostLine";
import { PromotionsCheckoutPayLazy } from "@/components/dashboard/PromotionsCheckoutPayLazy";
import { PromotionsCheckoutPeriodFieldset } from "@/components/dashboard/promotions/PromotionsCheckoutPeriodFieldset";
import { PromotionKind } from "@/generated/prisma/enums";
import { dashboardPromotionsCheckoutPeriodUrl } from "@/lib/dashboard-promotions-path";
import { computedPeriodChoice } from "@/lib/promotion-checkout-period-display";
import { getPlacementPeriodChoicesForKind } from "@/lib/promotion-period-calendar-cache";
import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** Client checkout body — loading spinner on period click until navigation/pricing finishes. */
export function PromotionsCheckoutBody(props: {
  kind: PlacementCheckoutPromotionKind;
  selectedOffset: 0 | 1 | 2 | null;
  computedPeriodChoices: PlacementPeriodChoiceUi[] | null;
  mockPromotionCheckout: boolean;
  stripePublishableKey: string;
  promotionCreditsAvailable?: number;
  queryPreserve?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingOffset, setLoadingOffset] = useState<0 | 1 | 2 | null>(null);

  const serverComputed = props.selectedOffset != null && props.computedPeriodChoices != null;
  const clientChoices =
    !serverComputed && props.selectedOffset != null
      ? getPlacementPeriodChoicesForKind(props.kind)
      : null;
  const periodChoicesForUi = serverComputed ? props.computedPeriodChoices : clientChoices;
  const hasPeriodData = periodChoicesForUi != null;
  const pricingLoading =
    (isPending || (props.selectedOffset != null && !serverComputed)) && !hasPeriodData;
  const pricingReady = props.selectedOffset != null && hasPeriodData;
  const captureScroll = usePreserveScrollOnSettled(pricingLoading, pricingReady);
  const pendingOffset = pricingLoading && isPending ? loadingOffset : null;

  const selected =
    hasPeriodData && props.selectedOffset != null
      ? computedPeriodChoice(periodChoicesForUi!, props.selectedOffset)
      : undefined;

  function onNavigatePeriod(offset: 0 | 1 | 2, href: string) {
    captureScroll();
    setLoadingOffset(offset);
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <>
      <PromotionsCheckoutPeriodFieldset
        kind={props.kind}
        selectedOffset={props.selectedOffset}
        computedPeriodChoices={periodChoicesForUi}
        loadingOffset={pendingOffset}
        getPeriodHref={(offset) =>
          dashboardPromotionsCheckoutPeriodUrl(props.kind, offset, props.queryPreserve)
        }
        onNavigatePeriod={onNavigatePeriod}
      />

      {pricingLoading ? (
        <PromotionCheckoutCostLine
          kind={props.kind as PromotionKind}
          amountCents={null}
          loading
        />
      ) : selected?.selectable ? (
        <PromotionsCheckoutPayLazy
          kind={props.kind as PromotionKind}
          placementOffset={props.selectedOffset!}
          amountCents={selected.amountCents}
          mockPay={props.mockPromotionCheckout}
          stripePublishableKey={props.stripePublishableKey}
          promotionCreditsAvailable={props.promotionCreditsAvailable}
        />
      ) : hasPeriodData && selected && !selected.selectable ? (
        <p className="mt-3 text-xs text-amber-200/90">
          {selected.disabledReason ?? "This period is not available."}
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-500">Choose a placement period to see dates and pricing.</p>
      )}
    </>
  );
}
