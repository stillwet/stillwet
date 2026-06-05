import {
  LISTING_ARTWORK_BROWSER_CROP_SOURCE_MAX_BYTES,
} from "@/lib/listing-request-artwork-limits";

/** Decoded source above this uses server crop even without a print template. */
export const LISTING_ARTWORK_BROWSER_CROP_SOURCE_MAX_PIXELS = 8_000_000;

/**
 * Client-safe: whether crop export should run on the server (sharp) instead of the browser.
 *
 * Any admin catalog item with a print template always uses server crop so large source files
 * cannot OOM the tab while building rotated/cropped canvases.
 */
export function listingArtworkUseServerSideCrop(
  printWidthPx: number,
  printHeightPx: number,
  sourceBytes: number,
  sourceWidthPx?: number | null,
  sourceHeightPx?: number | null,
): boolean {
  if (printWidthPx > 0 && printHeightPx > 0) return true;

  if (sourceWidthPx != null && sourceHeightPx != null && sourceWidthPx > 0 && sourceHeightPx > 0) {
    if (sourceWidthPx * sourceHeightPx > LISTING_ARTWORK_BROWSER_CROP_SOURCE_MAX_PIXELS) return true;
  }
  if (sourceBytes > LISTING_ARTWORK_BROWSER_CROP_SOURCE_MAX_BYTES) return true;
  return false;
}
