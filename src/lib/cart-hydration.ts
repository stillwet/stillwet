import { prisma } from "@/lib/prisma";
import type { CartLine } from "@/lib/session";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { buyerSalesShopConnectPrismaWhere } from "@/lib/shop-stripe-connect-gate";

/**
 * Cart keys are `ShopListing.id` (cuid). Legacy sessions used `Product.id` for the platform shop only;
 * map those to the platform listing row when the key is not a live listing id.
 *
 * `Product.id` and `ShopListing.id` are both cuids — we must resolve by listing id first, not by prefix.
 */
export async function hydrateCartListingKeys(
  items: Record<string, CartLine>,
): Promise<Record<string, CartLine>> {
  const out: Record<string, CartLine> = {};
  for (const [k, line] of Object.entries(items)) {
    if (!line || (line.quantity ?? 0) <= 0) continue;

    const byListingId = await prisma.shopListing.findFirst({
      where: {
        id: k,
        ...storefrontShopListingWhere,
        shop: { active: true, ...buyerSalesShopConnectPrismaWhere() },
      },
      select: { id: true },
    });
    if (byListingId) {
      out[byListingId.id] = line;
      continue;
    }

    const listing = await prisma.shopListing.findFirst({
      where: {
        productId: k,
        shop: { slug: PLATFORM_SHOP_SLUG },
        ...storefrontShopListingWhere,
      },
      select: { id: true },
    });
    if (listing) out[listing.id] = line;
  }
  return out;
}

export async function inferShopIdFromListingIds(
  listingIds: string[],
): Promise<string | null> {
  if (listingIds.length === 0) return null;
  const first = listingIds[0]!;
  const row = await prisma.shopListing.findUnique({
    where: { id: first },
    select: { shopId: true },
  });
  return row?.shopId ?? null;
}
