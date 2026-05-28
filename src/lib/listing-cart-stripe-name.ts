import type { Product } from "@/generated/prisma/client";
import type { CartLine } from "@/lib/session";
import { getPrintifyVariantsForProduct, resolvePrintifyCheckoutLine } from "@/lib/printify-variants";
import { storefrontListingDisplayTitle } from "@/lib/storefront-listing-display-name";

type P = Pick<
  Product,
  "name" | "slug" | "fulfillmentType" | "priceCents" | "printifyVariantId" | "printifyVariants"
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
  if (getPrintifyVariantsForProduct(p).length > 1) {
    const r = resolvePrintifyCheckoutLine(p, cartLine, { stripeBaseName: stripeBase });
    if (!r) return { name: stripeBase, printifyVariantId: p.printifyVariantId };
    return { name: r.stripeName, printifyVariantId: r.printifyVariantId };
  }
  const listingVid = listing.listingPrintifyVariantId?.trim();
  if (listingVid) {
    return { name: stripeBase, printifyVariantId: listingVid };
  }
  const r = resolvePrintifyCheckoutLine(p, cartLine, { stripeBaseName: stripeBase });
  if (!r) return { name: stripeBase, printifyVariantId: p.printifyVariantId };
  return { name: r.stripeName, printifyVariantId: r.printifyVariantId };
}
