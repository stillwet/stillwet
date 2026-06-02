/** Shown when {@link isStorefrontBuyerCheckoutDisabled} is true. */
export const STOREFRONT_BUYER_CHECKOUT_DISABLED_MESSAGE =
  "Item checkout is temporarily unavailable while we are in beta. You can still add items to your cart.";

/**
 * When `STOREFRONT_BUYER_CHECKOUT_DISABLED` is `1` / `true` / `yes`, buyers cannot start cart payment
 * (`startCheckout`). Creator charges (signup, listings, promotions, gifts) are unchanged.
 */
export function isStorefrontBuyerCheckoutDisabled(): boolean {
  const v = process.env.STOREFRONT_BUYER_CHECKOUT_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
