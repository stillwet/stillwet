"use client";

import { PromotionKind } from "@/generated/prisma/enums";
import { PromotionPlacementPay } from "@/components/dashboard/PromotionPlacementPay";

/** Pay control (mock or Stripe Checkout redirect). */
export function PromotionCheckoutPayStep(props: {
  kind: PromotionKind;
  placementOffset: 0 | 1 | 2;
  amountCents: number;
  periodLabel: string;
  mockPay: boolean;
}) {
  return <PromotionPlacementPay {...props} />;
}
