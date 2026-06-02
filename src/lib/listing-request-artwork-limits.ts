/**
 * Listing request artwork limits (client-safe — no sharp).
 *
 * Other site images use ~100 KiB WebP in `shop-setup-image.ts` (profile, supplements, etc.).
 * Listing request files are stored at full quality up to these caps via
 * `prepareListingRequestArtworkUpload` on the server only.
 */

/** Max upload size for listing request artwork (before processing). */
export const LISTING_REQUEST_ARTWORK_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/** Max stored listing request file on R2 (original PNG/JPEG or WebP). */
export const LISTING_REQUEST_ARTWORK_MAX_STORED_BYTES = 20 * 1024 * 1024;

export const LISTING_REQUEST_ARTWORK_MAX_SOURCE_MB =
  LISTING_REQUEST_ARTWORK_MAX_SOURCE_BYTES / (1024 * 1024);
