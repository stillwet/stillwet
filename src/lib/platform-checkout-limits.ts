/**
 * Platform-wide checkout limits — keep aligned with Stripe Checkout in `startCheckout`
 * (`src/actions/checkout.ts`).
 */

import { getShippingFlatCents } from "@/lib/shipping";

/** ISO 3166-1 alpha-2 — Stripe `shipping_address_collection.allowed_countries`. */
export const PLATFORM_CHECKOUT_SHIPPING_COUNTRIES = ["US"] as const;

export type PlatformCheckoutShippingCountry = (typeof PLATFORM_CHECKOUT_SHIPPING_COUNTRIES)[number];

export function platformCheckoutShippingCountryCodes(): PlatformCheckoutShippingCountry[] {
  return [...PLATFORM_CHECKOUT_SHIPPING_COUNTRIES];
}

export function platformCheckoutShippingCountryLabels(locale = "en"): string[] {
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  return PLATFORM_CHECKOUT_SHIPPING_COUNTRIES.map((code) => regions.of(code) ?? code);
}

/** Same as {@link getShippingFlatCents} — used at Stripe session creation. */
export function platformFlatShippingCents(): number {
  return getShippingFlatCents();
}

/** ISO country for new Stripe Connect Express accounts (`dashboardStartStripeConnect`). */
export function platformStripeConnectAccountCountryCode(): string {
  return process.env.STRIPE_CONNECT_ACCOUNT_COUNTRY?.trim() || "US";
}

export function platformStripeConnectAccountCountryLabel(locale = "en"): string {
  const code = platformStripeConnectAccountCountryCode();
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}
