"use client";

import { useEffect, useState } from "react";
import { PromotionKind } from "@/generated/prisma/enums";
import { PromotionCheckoutCostLine } from "@/components/dashboard/PromotionCheckoutCostLine";
import { PromotionPlacementPay } from "@/components/dashboard/PromotionPlacementPay";
import { usePreserveScrollOnSettled } from "@/lib/use-preserve-scroll-on-settled";

/** Cost line + pay — spinner beside cost while the pay chunk loads. */
export function PromotionsCheckoutPayLazy(props: {
  kind: PromotionKind;
  placementOffset: 0 | 1 | 2;
  amountCents: number;
  mockPay: boolean;
  stripePublishableKey: string;
  promotionCreditsAvailable?: number;
}) {
  const [ready, setReady] = useState(false);
  const captureScroll = usePreserveScrollOnSettled(!ready, ready);
  const displayAmountCents =
    (props.promotionCreditsAvailable ?? 0) > 0 ? 0 : props.amountCents;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    captureScroll();
    void import("@/components/dashboard/PromotionPlacementPay").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [props.kind, props.placementOffset, props.amountCents, props.promotionCreditsAvailable, captureScroll]);

  return (
    <>
      <PromotionCheckoutCostLine
        kind={props.kind}
        amountCents={displayAmountCents}
        loading={!ready}
      />
      {ready ? (
        <PromotionPlacementPay {...props} showCostLine={false} />
      ) : null}
    </>
  );
}
