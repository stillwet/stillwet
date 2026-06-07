/** Stripe receipt PaymentIntent description (buyer-visible). */
export function formatBuyerOrderNumber(orderNumber: number): string {
  return `Order #${orderNumber}`;
}

/** Inline short form for success page and UI copy. */
export function formatBuyerOrderNumberShort(orderNumber: number): string {
  return `#${orderNumber}`;
}
