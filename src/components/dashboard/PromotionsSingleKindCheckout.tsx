"use client";

import { PromotionKind } from "@/generated/prisma/enums";
import { PromotionsInlineCheckout } from "@/components/dashboard/PromotionsInlineCheckout";
import type { PromotionCheckoutSlotsByKind } from "@/lib/dashboard-promotions-payload-types";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

/** @deprecated Use {@link PromotionsInlineCheckout}; keeps legacy import paths working. */
export function PromotionsSingleKindCheckout(props: {
  kind: PromotionKind;
  periodSlotUiByKind?: PromotionCheckoutSlotsByKind;
  mockPromotionCheckout: boolean;
  stripePublishableKey?: string;
  onClose: () => void;
}) {
  const { kind, mockPromotionCheckout, stripePublishableKey = "", onClose } = props;
  return (
    <PromotionsInlineCheckout
      kind={kind as PlacementCheckoutPromotionKind}
      mockPromotionCheckout={mockPromotionCheckout}
      stripePublishableKey={stripePublishableKey}
      onClose={onClose}
    />
  );
}
