/**
 * Buyer-facing merchandise shipping added at cart preview and Stripe Checkout.
 * Policy: free shipping (flat `0`); do not reintroduce `SHIPPING_FLAT_CENTS` without revisiting
 * cart copy, PDP “Item details”, and order `shippingCents` semantics.
 */
export function getShippingFlatCents(): number {
  return 0;
}
