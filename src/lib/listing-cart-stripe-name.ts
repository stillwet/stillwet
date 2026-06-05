import type { Product } from "@/generated/prisma/client";
import type { CartLine } from "@/lib/session";
import { listingCheckoutPrintifyVariantId } from "@/lib/printify-variants";
import { storefrontListingDisplayTitle } from "@/lib/storefront-listing-display-name";

type P = Pick<
  Product,
  "name" | "slug" | "fulfillmentType" | "priceCents" | "printifyVariantId"
> & {
  adminCatalogItemPlatformLinks?: { name: string }[] | null;
};

export function listingStripeProductName(
  listing: {
    requestItemName?: string | null;
    priceCents: number;
    listingPrintifyVariantId?: string | null;
    product: P;
  },
  cartLine: CartLine | undefined,
): { name: string; printifyVariantId: string | null } {
  const p = listing.product;
  const stripeBase = storefrontListingDisplayTitle({
    requestItemName: listing.requestItemName,
    adminCatalogItemName: null,
    product: p,
  });
  return {
    name: stripeBase,
    printifyVariantId: listingCheckoutPrintifyVariantId(listing, p, cartLine),
  };
}
