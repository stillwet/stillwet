/** Backend proxy for “7 days from delivery” until Printify delivery dates are stored. */
export const ORDER_RETURN_CLAIM_MAX_DAYS_FROM_ORDER = 21;

export const ORDER_RETURN_CLAIM_MAX_PHOTOS = 3;

export const ORDER_RETURN_CLAIM_OUTSIDE_WINDOW_MESSAGE =
  "Outside of claim window. Claims must be submitted within 7 days of delivery.";

export function daysSinceOrderPlaced(orderCreatedAt: Date, now = new Date()): number {
  const ms = now.getTime() - orderCreatedAt.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function isWithinOrderReturnClaimWindow(orderCreatedAt: Date, now = new Date()): boolean {
  return daysSinceOrderPlaced(orderCreatedAt, now) <= ORDER_RETURN_CLAIM_MAX_DAYS_FROM_ORDER;
}
