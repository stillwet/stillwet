/**
 * Listing request artwork limits (client-safe — no sharp).
 *
 * - **Upload** (browser → server): up to 30 MB so creators can use high-res sources for crop/DPI.
 * - **Stored** (R2 after crop): up to 15 MB via dimension-preserving compression on the server.
 *
 * Profile / supplement images use ~100 KiB WebP in `shop-setup-image.ts`.
 */

/** Max bytes accepted on upload (pre-crop source or post-crop submit). */
export const LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;

/** Max bytes written to R2 after optional server compression (same pixel dimensions). */
export const LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES = 15 * 1024 * 1024;

/** @deprecated Alias — use {@link LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES}. */
export const LISTING_REQUEST_ARTWORK_LARGE_MAX_BYTES = LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;

/** @deprecated Alias — use {@link LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES}. */
export const LISTING_REQUEST_ARTWORK_DEFAULT_MAX_BYTES = LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES;

/** Largest listing artwork allowed anywhere (Next.js body limit should exceed this). */
export const LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES = LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;

export const LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB =
  LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES / (1024 * 1024);

export const LISTING_REQUEST_ARTWORK_STORED_MAX_MB =
  LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES / (1024 * 1024);

export const LISTING_REQUEST_ARTWORK_PLATFORM_MAX_MB =
  LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES / (1024 * 1024);

/** @deprecated Use {@link LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB}. */
export const LISTING_REQUEST_ARTWORK_LARGE_MAX_MB = LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB;

/** @deprecated Use {@link LISTING_REQUEST_ARTWORK_STORED_MAX_MB}. */
export const LISTING_REQUEST_ARTWORK_DEFAULT_MAX_MB = LISTING_REQUEST_ARTWORK_STORED_MAX_MB;

export function listingRequestArtworkUploadMaxBytes(): number {
  return LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;
}

export function listingRequestArtworkUploadMaxMb(): number {
  return LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB;
}

export function listingRequestArtworkStoredMaxBytes(): number {
  return LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES;
}

export function listingRequestArtworkStoredMaxMb(): number {
  return LISTING_REQUEST_ARTWORK_STORED_MAX_MB;
}

/** @deprecated Per-item flag removed — upload is always {@link LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES}. */
export function listingRequestArtworkMaxBytes(_largeListingArtwork?: boolean): number {
  return LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;
}

/** @deprecated Per-item flag removed — upload is always {@link LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB} MB. */
export function listingRequestArtworkMaxMb(_largeListingArtwork?: boolean): number {
  return LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB;
}
