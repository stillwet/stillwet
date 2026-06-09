import type { Prisma } from "@/generated/prisma/client";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

/** When set, creator shops must finish Stripe Connect before buyer-facing sales go live. */
export function isMarketplaceStripeConnectRequired(): boolean {
  return process.env.MARKETPLACE_STRIPE_CONNECT === "1";
}

/**
 * Whether a creator shop can accept buyer checkout (destination charges).
 * Platform shop is always eligible.
 */
export function shopStripeConnectReadyForBuyerSales(shop: {
  slug: string;
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
}): boolean {
  if (shop.slug === PLATFORM_SHOP_SLUG) return true;
  if (!isMarketplaceStripeConnectRequired()) return true;
  return (
    Boolean(shop.stripeConnectAccountId?.trim()) && shop.connectChargesEnabled === true
  );
}

/** Prisma `ShopWhereInput` fragment — empty when Connect is not required. */
export function buyerSalesShopConnectPrismaWhere(): Prisma.ShopWhereInput {
  if (!isMarketplaceStripeConnectRequired()) return {};
  return {
    OR: [
      { slug: PLATFORM_SHOP_SLUG },
      {
        stripeConnectAccountId: { not: null },
        connectChargesEnabled: true,
      },
    ],
  };
}

export const SHOP_NOT_LIVE_CONNECT_MESSAGE =
  "Shop is not live until onboarding setup is complete.";

/**
 * Whether the shop can be charged a listing publication fee via Stripe (Connect must be usable).
 */
export function shopStripeConnectReadyForListingCharges(shop: {
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
}): boolean {
  return (
    Boolean(shop.stripeConnectAccountId?.trim()) &&
    shop.connectChargesEnabled === true &&
    shop.payoutsEnabled === true
  );
}
