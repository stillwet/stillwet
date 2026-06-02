/**
 * Listing request artwork limits (client-safe — no sharp).
 *
 * - **Picker** (browser): up to 30 MB; files over 20 MB are re-encoded in-browser before crop (see pre-crop cap).
 * - **Upload** (post-crop / no crop): up to 30 MB to staging.
 * - **Stored** (R2 after crop): up to 15 MB via dimension-preserving compression on the server.
 *
 * Profile / supplement images use ~100 KiB WebP in `shop-setup-image.ts`.
 * All listing artwork uploads use chunked staging (`listing-artwork-staging/chunk`) before submit.
 */

/** Max bytes accepted on upload (post-crop submit or non-crop path). */
export const LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;

/** Re-encode in the browser before crop when the picked file exceeds this size. */
export const LISTING_REQUEST_ARTWORK_PRE_CROP_MAX_BYTES = 20 * 1024 * 1024;

/** Max bytes written to R2 after optional server compression (same pixel dimensions). */
export const LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES = 15 * 1024 * 1024;

/** Largest listing artwork allowed anywhere (Next.js body limit should exceed this). */
export const LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES = LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;

export const LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB =
  LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES / (1024 * 1024);

export const LISTING_REQUEST_ARTWORK_PRE_CROP_MAX_MB =
  LISTING_REQUEST_ARTWORK_PRE_CROP_MAX_BYTES / (1024 * 1024);

export const LISTING_REQUEST_ARTWORK_STORED_MAX_MB =
  LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES / (1024 * 1024);

export const LISTING_REQUEST_ARTWORK_PLATFORM_MAX_MB =
  LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES / (1024 * 1024);

export function listingRequestArtworkUploadMaxBytes(): number {
  return LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;
}

export function listingRequestArtworkUploadMaxMb(): number {
  return LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB;
}

export function listingRequestArtworkPreCropMaxBytes(): number {
  return LISTING_REQUEST_ARTWORK_PRE_CROP_MAX_BYTES;
}

export function listingRequestArtworkPreCropMaxMb(): number {
  return LISTING_REQUEST_ARTWORK_PRE_CROP_MAX_MB;
}

export function listingRequestArtworkStoredMaxBytes(): number {
  return LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES;
}

export function listingRequestArtworkStoredMaxMb(): number {
  return LISTING_REQUEST_ARTWORK_STORED_MAX_MB;
}

/** Per-request chunk for same-origin staging upload (under Vercel ~4.5 MB body cap). */
export const LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES = 2.5 * 1024 * 1024;
