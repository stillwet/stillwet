import { prisma } from "@/lib/prisma";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { buyerSalesShopConnectPrismaWhere } from "@/lib/shop-stripe-connect-gate";
import type { Product, Tag } from "@/generated/prisma/client";
import { getCartSessionReadonly } from "@/lib/session";
import { listingCartUnitCents } from "@/lib/listing-cart-price";
import { productHref } from "@/lib/marketplace-constants";
import { storefrontListingDisplayTitle } from "@/lib/storefront-listing-display-name";
import { STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE } from "@/lib/storefront-listing-product-include";

export type ActiveCartRowProduct = Product & { primaryTag: Tag | null };

export type ActiveCartRow = {
  listingId: string;
  shopSlug: string;
  product: ActiveCartRowProduct;
  quantity: number;
  line: number;
  unit: number;
  variantSub: string | null;
  /** PDP/cart line title — admin catalog + listing name, not Printify `Product.name`. */
  lineDisplayName: string;
};

export async function loadActiveCartRows(): Promise<{
  rows: ActiveCartRow[];
  subtotal: number;
}> {
  const session = await getCartSessionReadonly();
  const ids = Object.keys(session.items).filter(
    (id) => (session.items[id]?.quantity ?? 0) > 0,
  );
  if (ids.length === 0) {
    return { rows: [], subtotal: 0 };
  }

  const listings = await prisma.shopListing.findMany({
    where: {
      id: { in: ids },
      ...storefrontShopListingWhere,
      shop: { active: true, ...buyerSalesShopConnectPrismaWhere() },
    },
    include: {
      shop: { select: { slug: true } },
      product: {
        include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE,
      },
    },
  });

  const rows: ActiveCartRow[] = listings.map((listing) => {
    const p = listing.product;
    const cartLine = session.items[listing.id];
    const q = cartLine?.quantity ?? 0;
    const unit = listingCartUnitCents(listing, cartLine);
    const line = unit * q;
    return {
      listingId: listing.id,
      shopSlug: listing.shop.slug,
      product: p,
      quantity: q,
      line,
      unit,
      variantSub: null,
      lineDisplayName: storefrontListingDisplayTitle({
        requestItemName: listing.requestItemName,
        product: p,
      }),
    };
  });

  const subtotal = rows.reduce((s, r) => s + r.line, 0);
  return { rows, subtotal };
}

export function cartRowProductHref(row: ActiveCartRow): string {
  return productHref(row.shopSlug, row.product.slug);
}
