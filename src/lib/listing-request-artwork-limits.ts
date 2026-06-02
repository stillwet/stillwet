/**
 * Listing request artwork limits (client-safe — no sharp).
 *
 * Other site images use ~100 KiB WebP in `shop-setup-image.ts` (profile, supplements, etc.).
 * Listing request files are stored at full quality up to these caps via
 * `prepareListingRequestArtworkUpload` on the server only.
 */

/** Default max upload for most admin catalog items. */
export const LISTING_REQUEST_ARTWORK_DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

/** Max upload when admin marks the catalog item as large-artwork. */
export const LISTING_REQUEST_ARTWORK_LARGE_MAX_BYTES = 30 * 1024 * 1024;

/** Largest listing artwork allowed anywhere (Next.js body limit should exceed this). */
export const LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES = LISTING_REQUEST_ARTWORK_LARGE_MAX_BYTES;

export const LISTING_REQUEST_ARTWORK_DEFAULT_MAX_MB =
  LISTING_REQUEST_ARTWORK_DEFAULT_MAX_BYTES / (1024 * 1024);

export const LISTING_REQUEST_ARTWORK_LARGE_MAX_MB =
  LISTING_REQUEST_ARTWORK_LARGE_MAX_BYTES / (1024 * 1024);

export const LISTING_REQUEST_ARTWORK_PLATFORM_MAX_MB =
  LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES / (1024 * 1024);

export function listingRequestArtworkMaxBytes(largeListingArtwork: boolean): number {
  return largeListingArtwork
    ? LISTING_REQUEST_ARTWORK_LARGE_MAX_BYTES
    : LISTING_REQUEST_ARTWORK_DEFAULT_MAX_BYTES;
}

export function listingRequestArtworkMaxMb(largeListingArtwork: boolean): number {
  return listingRequestArtworkMaxBytes(largeListingArtwork) / (1024 * 1024);
}
