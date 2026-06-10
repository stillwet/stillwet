import { checkoutTipProcessingSurchargeCents } from "@/lib/checkout-tip";
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
  const grossUp = grossUpCardProcessingFeeCents(baseBeforeProcessing);
  const tipSurcharge = checkoutTipProcessingSurchargeCents(tipCents);
  return grossUp + tipSurcharge;
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

/** Inverts {@link buyerCheckoutTotalCents} for platform checkouts (no cart tax/tip). */
export function merchandiseSubtotalFromCheckoutTotalCents(checkoutTotalCents: number): number {
  const total = Math.max(0, Math.round(checkoutTotalCents));
  if (total <= 0) return 0;
  let lo = 0;
  let hi = total;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (buyerCheckoutTotalCents(mid) <= total) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Stripe balance fee on a card charge (2.9% + 30¢ on the full amount, rounded to nearest cent).
 * Use for admin reconciliation against Stripe Dashboard — not the naive fee on merchandise alone.
 */
export function stripeBalanceProcessingFeeCents(chargeCents: number): number {
  const charge = Math.max(0, Math.round(chargeCents));
  if (charge <= 0) return 0;
  return Math.round(
    charge * STRIPE_CARD_PROCESSING_PERCENT + STRIPE_CARD_PROCESSING_FIXED_CENTS,
  );
}

/** Buyer-paid Stripe pass-through on a checkout total (merchandise subtotal when known). */
export function checkoutProcessingFeeFromTotal(
  checkoutTotalCents: number,
  merchandiseSubtotalCents?: number,
): number {
  const total = Math.max(0, Math.round(checkoutTotalCents));
  if (total <= 0) return 0;
  const merchandise =
    merchandiseSubtotalCents != null
      ? Math.max(0, Math.min(Math.round(merchandiseSubtotalCents), total))
      : merchandiseSubtotalFromCheckoutTotalCents(total);
  return Math.max(0, total - merchandise);
}
