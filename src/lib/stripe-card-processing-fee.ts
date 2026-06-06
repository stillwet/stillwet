import {
  buyerStripeTaxServiceFeeCents,
  STRIPE_TAX_SERVICE_FEE_TAX_CODE,
} from "@/lib/stripe-tax-buyer-fee";

/** US card rate estimate for Checkout pass-through (2.9% + $0.30). */
export const STRIPE_CARD_PROCESSING_PERCENT = 0.029;
export const STRIPE_CARD_PROCESSING_FIXED_CENTS = 30;

export const PAYMENT_PROCESSING_LABEL = "Payment Processing";

/** @deprecated Use {@link PAYMENT_PROCESSING_LABEL}. */
export const STRIPE_CARD_PROCESSING_FEE_LABEL = PAYMENT_PROCESSING_LABEL;

function grossUpCardProcessingFeeCents(baseBeforeProcessingCents: number): number {
  if (baseBeforeProcessingCents <= 0) return 0;
  const totalCents = Math.ceil(
    (baseBeforeProcessingCents + STRIPE_CARD_PROCESSING_FIXED_CENTS) /
      (1 - STRIPE_CARD_PROCESSING_PERCENT),
  );
  return totalCents - baseBeforeProcessingCents;
}

/** Gross-up so the platform nets `subtotalCents` after Stripe's fee on the full charge. */
export function buyerCardProcessingFeeCents(subtotalCents: number): number {
  return grossUpCardProcessingFeeCents(subtotalCents);
}

export function buyerPaymentProcessingFeeCents(input: {
  subtotalCents: number;
  shippingCents?: number;
  tipCents?: number;
  includeTaxService?: boolean;
}): number {
  const subtotalCents = Math.max(0, Math.round(input.subtotalCents));
  const shippingCents = Math.max(0, Math.round(input.shippingCents ?? 0));
  const tipCents = Math.max(0, Math.round(input.tipCents ?? 0));
  const taxServiceCents = input.includeTaxService
    ? buyerStripeTaxServiceFeeCents({
        subtotalCents,
        shippingCents,
        tipCents,
        enabled: true,
      })
    : 0;
  const baseBeforeProcessing = subtotalCents + shippingCents + tipCents + taxServiceCents;
  return grossUpCardProcessingFeeCents(baseBeforeProcessing);
}

export function buyerCheckoutTotalCents(
  subtotalCents: number,
  options?: { includeTaxService?: boolean },
): number {
  return (
    subtotalCents +
    buyerPaymentProcessingFeeCents({
      subtotalCents,
      includeTaxService: options?.includeTaxService,
    })
  );
}

export function stripeCheckoutPaymentProcessingLineItem(input: {
  subtotalCents: number;
  shippingCents?: number;
  tipCents?: number;
  includeTaxService?: boolean;
  /** When true, line item is taxed like merchandise (cart). Default: non-taxable service fee. */
  exclusiveTax?: boolean;
}) {
  const feeCents = buyerPaymentProcessingFeeCents(input);
  if (feeCents <= 0) return null;
  const exclusiveTax = input.exclusiveTax ?? false;
  return {
    quantity: 1 as const,
    price_data: {
      currency: "usd" as const,
      unit_amount: feeCents,
      ...(exclusiveTax ? { tax_behavior: "exclusive" as const } : {}),
      product_data: {
        name: PAYMENT_PROCESSING_LABEL,
        tax_code: STRIPE_TAX_SERVICE_FEE_TAX_CODE,
        metadata: { kind: "payment_processing" },
      },
    },
  };
}

/** @deprecated Use {@link stripeCheckoutPaymentProcessingLineItem}. */
export function stripeCheckoutProcessingFeeLineItem(subtotalCents: number) {
  return stripeCheckoutPaymentProcessingLineItem({ subtotalCents });
}
