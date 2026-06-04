import {
  isStripeCheckoutAutomaticTaxEnabled,
} from "@/lib/stripe-checkout-tax";

/** Stripe Tax Basic — Checkout integration (approximate pass-through rate). */
export const STRIPE_TAX_BUYER_FEE_RATE = 0.005;

export const STRIPE_TAX_BUYER_FEE_LABEL = "Sales tax processing";

/** Non-taxable platform service fee (not merchandise sales tax). */
export const STRIPE_TAX_SERVICE_FEE_TAX_CODE = "txcd_00000000";

export function parseStripeTaxBuyerFeeRate(): number {
  const raw = process.env.STRIPE_TAX_BUYER_FEE_RATE?.trim();
  if (!raw) return STRIPE_TAX_BUYER_FEE_RATE;
  const r = Number(raw);
  if (!Number.isFinite(r) || r < 0 || r > 0.05) return STRIPE_TAX_BUYER_FEE_RATE;
  return r;
}

/** Pass Stripe Tax service cost to buyers when automatic tax is on (default). */
export function isStripeTaxBuyerFeePassThroughEnabled(): boolean {
  if (!isStripeCheckoutAutomaticTaxEnabled()) return false;
  const raw = process.env.STRIPE_TAX_BUYER_FEE?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}

export function buyerStripeTaxServiceFeeCents(input: {
  subtotalCents: number;
  shippingCents: number;
  tipCents: number;
  enabled?: boolean;
}): number {
  const enabled = input.enabled ?? isStripeTaxBuyerFeePassThroughEnabled();
  if (!enabled) return 0;
  const base = input.subtotalCents + input.shippingCents + input.tipCents;
  if (base <= 0) return 0;
  const fee = Math.round(base * parseStripeTaxBuyerFeeRate());
  return fee > 0 ? fee : 0;
}

export function stripeCheckoutTaxServiceFeeLineItem(input: {
  subtotalCents: number;
  shippingCents: number;
  tipCents: number;
  automaticTaxEnabled: boolean;
}) {
  const feeCents = buyerStripeTaxServiceFeeCents({
    ...input,
    enabled: input.automaticTaxEnabled && isStripeTaxBuyerFeePassThroughEnabled(),
  });
  if (feeCents <= 0) return null;
  return {
    quantity: 1 as const,
    price_data: {
      currency: "usd" as const,
      unit_amount: feeCents,
      tax_behavior: "exclusive" as const,
      product_data: {
        name: STRIPE_TAX_BUYER_FEE_LABEL,
        tax_code: STRIPE_TAX_SERVICE_FEE_TAX_CODE,
        metadata: { kind: "stripe_tax_service_fee" },
      },
    },
  };
}
