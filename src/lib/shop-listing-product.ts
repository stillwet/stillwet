import type { ProductCardProduct } from "@/components/ProductCard";
import { parseListingStorefrontCatalogImageSelection } from "@/lib/product-media";
import {
  sanitizeShopListingAdminSecondaryImageUrlForDisplay,
  sanitizeShopListingOwnerSupplementImageUrlForDisplay,
} from "@/lib/r2-upload";
import {
  firstLinkedAdminCatalogItemName,
  storefrontListingDisplayTitle,
  titleFromProductSlug,
} from "@/lib/storefront-listing-display-name";

export function productCardProductFromListing<
  LP extends {
    id: string;
    shopId: string;
    priceCents: number;
    product: ProductCardProduct;
    requestItemName?: string | null;
    adminListingSecondaryImageUrl?: string | null;
    ownerSupplementImageUrl?: string | null;
    listingStorefrontCatalogImageUrls?: unknown;
    shop?: { slug: string; displayName?: string } | null;
  },
>(listing: LP): ProductCardProduct {
  const name = storefrontListingDisplayTitle({
    requestItemName: listing.requestItemName,
    adminCatalogItemName: null,
    product: listing.product,
  });
  const catalogProductName =
    firstLinkedAdminCatalogItemName(listing.product) ?? titleFromProductSlug(listing.product.slug);
  const catalogSel = parseListingStorefrontCatalogImageSelection(
    listing.listingStorefrontCatalogImageUrls,
  );
  const storefrontShopSlug = listing.shop?.slug?.trim() || undefined;
  const storefrontShopDisplayName = listing.shop?.displayName?.trim() || undefined;
  return {
    ...listing.product,
    name,
    catalogProductName,
    priceCents: listing.priceCents,
    ...(storefrontShopSlug ? { storefrontShopSlug } : {}),
    ...(storefrontShopDisplayName ? { storefrontShopDisplayName } : {}),
    adminListingSecondaryImageUrl: sanitizeShopListingAdminSecondaryImageUrlForDisplay(
      listing.adminListingSecondaryImageUrl,
      listing.shopId,
      listing.id,
    ),
    ownerSupplementImageUrl: sanitizeShopListingOwnerSupplementImageUrlForDisplay(
      listing.ownerSupplementImageUrl,
      listing.shopId,
      listing.id,
    ),
    ...(catalogSel !== null ? { listingStorefrontCatalogImageUrls: catalogSel } : {}),
  };
}
