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

/** Max decoded source pixels for typical phone-safe catalog items. */
export const LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS = 24_000_000;

/**
 * Max decoded source pixels for camera / vector only items (largest print template 6400×8400 ≈ 54 MP).
 */
export const LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES = 54_000_000;

/** Velveteen blanket print template (unique in admin catalog fixtures). */
export const LISTING_ARTWORK_BLANKET_PRINT_WIDTH_PX = 6400;
export const LISTING_ARTWORK_BLANKET_PRINT_HEIGHT_PX = 8400;

/** Blanket-only: up to 8192×8192 source decode (~67 MP). */
export const LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS = 8192 * 8192;

/** Blanket-only: large uncompressed PNG sources (presigned R2 upload). */
export const LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES = 100 * 1024 * 1024;

export const LISTING_ARTWORK_BLANKET_SOURCE_MAX_MB =
  LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES / (1024 * 1024);

export function isBlanketCatalogPrintArea(
  printAreaWidthPx: number | null,
  printAreaHeightPx: number | null,
): boolean {
  if (printAreaWidthPx == null || printAreaHeightPx == null) return false;
  if (printAreaWidthPx <= 0 || printAreaHeightPx <= 0) return false;
  return (
    printAreaWidthPx === LISTING_ARTWORK_BLANKET_PRINT_WIDTH_PX &&
    printAreaHeightPx === LISTING_ARTWORK_BLANKET_PRINT_HEIGHT_PX
  );
}

/** Blanket catalog row — print template or name fallback when print px are unset in admin. */
export function isBlanketCatalogItem(
  printAreaWidthPx: number | null,
  printAreaHeightPx: number | null,
  catalogItemName?: string | null,
): boolean {
  if (isBlanketCatalogPrintArea(printAreaWidthPx, printAreaHeightPx)) return true;
  return String(catalogItemName ?? "")
    .trim()
    .toLowerCase()
    .includes("blanket");
}

export function listingArtworkDecodeMaxPixelsForPrintArea(
  printAreaWidthPx: number | null,
  printAreaHeightPx: number | null,
  artworkSourceTier: "phone_pic_safe" | "camera_or_vector_only",
  catalogItemName?: string | null,
): number {
  if (isBlanketCatalogItem(printAreaWidthPx, printAreaHeightPx, catalogItemName)) {
    return LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS;
  }
  if (artworkSourceTier === "camera_or_vector_only") {
    return LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES;
  }
  return LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS;
}

export function listingArtworkSourceMaxBytesForPrintArea(
  printAreaWidthPx: number | null,
  printAreaHeightPx: number | null,
  catalogItemName?: string | null,
): number {
  if (isBlanketCatalogItem(printAreaWidthPx, printAreaHeightPx, catalogItemName)) {
    return LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES;
  }
  return 50 * 1024 * 1024;
}
