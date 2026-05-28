/** Warm webpack chunks + Stripe.js before the user opens pay (client-only). */

let checkoutChunkInflight: Promise<unknown> | null = null;
let payChunkInflight: Promise<unknown> | null = null;
let stripeInflightKey: string | null = null;
let stripeInflight: Promise<unknown> | null = null;

export function prefetchPromotionCheckoutChunk(): void {
  if (typeof window === "undefined") return;
  if (!checkoutChunkInflight) {
    checkoutChunkInflight = import("@/components/dashboard/PromotionsCheckoutPeriodPaySection");
  }
}

export function prefetchPromotionPayChunk(): void {
  if (typeof window === "undefined") return;
  if (!payChunkInflight) {
    payChunkInflight = import("@/components/dashboard/PromotionPlacementPay");
  }
}

export function prefetchPromotionStripeJs(publishableKey: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const key = publishableKey?.trim();
  if (!key) return;
  if (stripeInflightKey === key && stripeInflight) return;
  stripeInflightKey = key;
  stripeInflight = import("@stripe/stripe-js").then((m) => m.loadStripe(key));
}

export function prefetchPromotionCheckoutWarmup(publishableKey: string | null | undefined): void {
  prefetchPromotionCheckoutChunk();
  prefetchPromotionPayChunk();
  prefetchPromotionStripeJs(publishableKey);
}

export function schedulePromotionCheckoutWarmup(publishableKey: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const run = () => prefetchPromotionCheckoutWarmup(publishableKey);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 400);
  }
}
