/** US card rate estimate for Checkout pass-through (2.9% + $0.30). */
export const STRIPE_CARD_PROCESSING_PERCENT = 0.029;
export const STRIPE_CARD_PROCESSING_FIXED_CENTS = 30;
export const STRIPE_CARD_PROCESSING_FEE_LABEL = "Card payment processing";

/** Gross-up so the platform nets `subtotalCents` after Stripe's fee on the full charge. */
export function buyerCardProcessingFeeCents(subtotalCents: number): number {
  if (subtotalCents <= 0) return 0;
  const totalCents = Math.ceil(
    (subtotalCents + STRIPE_CARD_PROCESSING_FIXED_CENTS) / (1 - STRIPE_CARD_PROCESSING_PERCENT),
  );
  return totalCents - subtotalCents;
}

export function buyerCheckoutTotalCents(subtotalCents: number): number {
  return subtotalCents + buyerCardProcessingFeeCents(subtotalCents);
}

export function stripeCheckoutProcessingFeeLineItem(subtotalCents: number) {
  const feeCents = buyerCardProcessingFeeCents(subtotalCents);
  if (feeCents <= 0) return null;
  return {
    quantity: 1 as const,
    price_data: {
      currency: "usd" as const,
      unit_amount: feeCents,
      product_data: {
        name: STRIPE_CARD_PROCESSING_FEE_LABEL,
      },
    },
  };
}
