"use client";

import { useEffect, useState } from "react";
import { PromotionKind } from "@/generated/prisma/enums";
import { PromotionCheckoutCostLine } from "@/components/dashboard/PromotionCheckoutCostLine";
import { PromotionPlacementPay } from "@/components/dashboard/PromotionPlacementPay";

/** Cost line + pay — spinner beside cost while the pay chunk loads. */
export function PromotionsCheckoutPayLazy(props: {
  kind: PromotionKind;
  placementOffset: 0 | 1 | 2;
  amountCents: number;
  periodLabel: string;
  mockPay: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@/components/dashboard/PromotionPlacementPay").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PromotionCheckoutCostLine
        kind={props.kind}
        periodLabel={props.periodLabel}
        amountCents={props.amountCents}
        loading={!ready}
      />
      {ready ? (
        <PromotionPlacementPay {...props} showCostLine={false} />
      ) : null}
    </>
  );
}
