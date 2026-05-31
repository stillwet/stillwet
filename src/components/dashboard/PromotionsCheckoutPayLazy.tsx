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
}) {
  const [ready, setReady] = useState(false);
  const captureScroll = usePreserveScrollOnSettled(!ready, ready);

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
  }, [props.kind, props.placementOffset, props.amountCents, captureScroll]);

  return (
    <>
      <PromotionCheckoutCostLine
        kind={props.kind}
        amountCents={props.amountCents}
        loading={!ready}
      />
      {ready ? (
        <PromotionPlacementPay {...props} showCostLine={false} />
      ) : null}
    </>
  );
}
