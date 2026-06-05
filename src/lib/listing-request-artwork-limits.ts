/**
 * Listing request artwork limits (client-safe — no sharp).
 *
 * - **Picker** (browser): up to 15 MB.
 * - **Crop path**: source uploads to staging (chunked), then `/api/dashboard/listing-artwork/bake`
 *   crops and writes final print file to `listing-request/` on **Upload + Crop** (not on submit).
 * - **Submit**: references pre-baked key only (~10 MB validation read, no crop RAM).
 *
 * Profile / supplement images use ~100 KiB WebP in `shop-setup-image.ts`.
 * All listing artwork uploads use chunked staging (`listing-artwork-staging/chunk`) before submit.
 */

/** Max bytes accepted when picking a file or uploading post-crop to staging. */
export const LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

/** Max bytes written to R2 after optional server compression (same pixel dimensions). */
export const LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES = 10 * 1024 * 1024;

/** Largest listing artwork allowed anywhere (Next.js body limit should exceed this). */
export const LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES = LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;

export const LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB =
  LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES / (1024 * 1024);

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

export function listingRequestArtworkStoredMaxBytes(): number {
  return LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES;
}

export function listingRequestArtworkStoredMaxMb(): number {
  return LISTING_REQUEST_ARTWORK_STORED_MAX_MB;
}

export function listingArtworkFileWithinUploadCap(bytes: number): boolean {
  return bytes > 0 && bytes <= LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;
}

/** Shown when the user picks or uploads a file over the upload cap. */
export function listingArtworkUploadCapError(): string {
  return `Uploads are capped at ${LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB} MB. Choose a smaller file.`;
}

/** Per-request chunk for same-origin staging upload (under Vercel ~4.5 MB body cap). */
export const LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES = 2.5 * 1024 * 1024;

/**
 * Legacy threshold for print templates without fixed dimensions (unused when print W×H are set).
 * All admin catalog items with print areas always use server crop.
 */
export const LISTING_ARTWORK_BROWSER_CROP_MAX_PIXELS = 10_000_000;

/** Large upload bytes trigger server crop when no print template is configured. */
export const LISTING_ARTWORK_BROWSER_CROP_SOURCE_MAX_BYTES = 6 * 1024 * 1024;

/** Max decoded source pixels for server crop (avoids multi-hundred-MB sharp workspaces). */
export const LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS = 24_000_000;
