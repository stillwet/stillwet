import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import {
  isMarketplaceStripeConnectRequired,
  shopStripeConnectReadyForBuyerSales,
} from "@/lib/shop-stripe-connect-gate";

export type ShopStorefrontPreviewContext = {
  isOwnerPreview: boolean;
  connectReadyForBuyerSales: boolean;
  showConnectNotLiveBanner: boolean;
};

/** Logged-in shop owner viewing their own `/s/[shopSlug]` storefront. */
export async function isViewingOwnShopStorefront(shopSlug: string): Promise<boolean> {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) return false;

  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { slug: true } } },
  });
  return row?.shop.slug === shopSlug;
}

export async function resolveShopStorefrontPreviewContext(
  shopSlug: string,
  shop: {
    slug: string;
    stripeConnectAccountId: string | null;
    connectChargesEnabled: boolean;
  },
): Promise<ShopStorefrontPreviewContext> {
  const connectReadyForBuyerSales = shopStripeConnectReadyForBuyerSales(shop);
  if (!isMarketplaceStripeConnectRequired() || connectReadyForBuyerSales) {
    return {
      isOwnerPreview: false,
      connectReadyForBuyerSales: true,
      showConnectNotLiveBanner: false,
    };
  }

  const isOwnerPreview = await isViewingOwnShopStorefront(shopSlug);
  return {
    isOwnerPreview,
    connectReadyForBuyerSales: false,
    showConnectNotLiveBanner: isOwnerPreview,
  };
}
