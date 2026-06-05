import type { Prisma } from "@/generated/prisma/client";
import { productAllStoredImageUrls } from "@/lib/product-media";
import {
  deleteListingImagesFromR2,
  deleteShopListingAdminSecondaryObject,
  deleteShopListingRequestImagesFromR2,
  deleteShopListingSupplementObject,
  deleteShopListingSupplementPendingObject,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";

function listingStorefrontCatalogImageUrlStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const x of value) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return out;
}

export type PurgeShopListingR2MediaParams = {
  shopId: string;
  listingId: string;
  requestImages?: unknown;
  listingStorefrontCatalogImageUrls?: unknown;
  product?: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  } | null;
};

/**
 * Best-effort delete of Cloudflare R2 objects for one shop listing: request artwork,
 * storefront catalog picks, Printify/product mockups under `listing/`, and per-listing
 * supplement / admin-secondary objects under `shops/{shopId}/`.
 */
export async function purgeShopListingR2Media(params: PurgeShopListingR2MediaParams): Promise<void> {
  const { shopId, listingId } = params;

  await deleteShopListingRequestImagesFromR2(
    shopId,
    shopListingRequestImageUrlStrings(params.requestImages),
  );

  const listingObjectUrls = [
    ...listingStorefrontCatalogImageUrlStrings(params.listingStorefrontCatalogImageUrls),
    ...(params.product ? productAllStoredImageUrls(params.product) : []),
  ];
  await deleteListingImagesFromR2(listingObjectUrls);

  await deleteShopListingSupplementObject(shopId, listingId);
  await deleteShopListingSupplementPendingObject(shopId, listingId);
  await deleteShopListingAdminSecondaryObject(shopId, listingId);
}
