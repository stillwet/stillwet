import type Stripe from "stripe";

/** General tangible goods — merchandise line items at buyer checkout. */
export const CHECKOUT_MERCHANDISE_STRIPE_TAX_CODE = "txcd_99999999";

export function isStripeCheckoutAutomaticTaxEnabled(): boolean {
  const raw = process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}

/** Stripe Tax on Checkout Sessions; Connect destination charges assign liability to the shop. */
export function stripeCheckoutAutomaticTax(
  connectedAccountId: string | null | undefined,
): Stripe.Checkout.SessionCreateParams.AutomaticTax {
  if (connectedAccountId) {
    return {
      enabled: true,
      liability: { type: "account", account: connectedAccountId },
    };
  }
  return { enabled: true };
}
