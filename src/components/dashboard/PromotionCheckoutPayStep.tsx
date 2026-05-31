"use client";

import { PromotionKind } from "@/generated/prisma/enums";
import { PromotionPlacementPay } from "@/components/dashboard/PromotionPlacementPay";

/** Pay control (mock or inline card). */
export function PromotionCheckoutPayStep(props: {
  kind: PromotionKind;
  placementOffset: 0 | 1 | 2;
  amountCents: number;
  periodLabel: string;
  mockPay: boolean;
  stripePublishableKey: string;
}) {
  return <PromotionPlacementPay {...props} />;
}
