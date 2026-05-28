/** Maximum optional cart tip (USD cents). */
export const MAX_CHECKOUT_TIP_CENTS = 500;

/** Platform keeps this much of each cart tip; remainder goes to the shop (Connect transfer). */
export const PLATFORM_TIP_FEE_CENTS = 25;

/** Stripe USD minimum for a paid line item when tip > 0. */
export const MIN_CHECKOUT_TIP_CENTS = 50;

export function splitCheckoutTipCents(tipCents: number): {
  platformTipFeeCents: number;
  shopTipCents: number;
} {
  const tip = Math.max(0, Math.round(tipCents));
  if (tip === 0) {
    return { platformTipFeeCents: 0, shopTipCents: 0 };
  }
  const platformTipFeeCents = Math.min(PLATFORM_TIP_FEE_CENTS, tip);
  return { platformTipFeeCents, shopTipCents: tip - platformTipFeeCents };
}

export function validateCheckoutTipCents(
  tipCents: number,
  tipAllowed: boolean,
): string | null {
  if (!Number.isFinite(tipCents) || tipCents < 0) {
    return "Invalid tip amount.";
  }
  if (tipCents === 0) {
    return null;
  }
  if (!tipAllowed) {
    return "Tips apply only when your cart includes sub catalog items.";
  }
  if (tipCents < MIN_CHECKOUT_TIP_CENTS) {
    return `Minimum tip is $${(MIN_CHECKOUT_TIP_CENTS / 100).toFixed(2)}.`;
  }
  if (tipCents > MAX_CHECKOUT_TIP_CENTS) {
    return `Maximum tip is $${(MAX_CHECKOUT_TIP_CENTS / 100).toFixed(2)}.`;
  }
  return null;
}

/** Clamp UI input to allowed tip range (0 or MIN..MAX). */
export function clampCheckoutTipCents(tipCents: number): number {
  const t = Math.round(tipCents);
  if (t <= 0) return 0;
  if (t < MIN_CHECKOUT_TIP_CENTS) return MIN_CHECKOUT_TIP_CENTS;
  return Math.min(MAX_CHECKOUT_TIP_CENTS, t);
}
