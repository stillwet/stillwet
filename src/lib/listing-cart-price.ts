import type { Product } from "@/generated/prisma/client";
import type { CartLine } from "@/lib/session";

/** Minimum shop price (cents): platform floor when set, else synced catalog retail on `Product.priceCents`. */
export function printifyVariantShopFloorCents(
  product: Pick<Product, "minPriceCents" | "priceCents">,
): number {
  const adminFloor = product.minPriceCents > 0 ? product.minPriceCents : 0;
  return Math.max(adminFloor, product.priceCents);
}

/** Dashboard "Catalog · min …" line: one number creators can compare to validation. */
export function dashboardListingMinPriceHintCents(
  product: Pick<Product, "minPriceCents" | "priceCents">,
): number {
  return printifyVariantShopFloorCents(product);
}

/** Unit price for cart/checkout: the shop listing's set price. */
export function listingCartUnitCents(
  listing: { priceCents: number },
  _cartLine: CartLine | undefined,
): number {
  return listing.priceCents;
}
