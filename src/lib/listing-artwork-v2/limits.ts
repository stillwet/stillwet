import {
  LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS,
  LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES,
  LISTING_ARTWORK_BLANKET_SOURCE_MAX_MB,
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS,
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES,
  listingArtworkSourceMaxBytesForPrintArea,
} from "@/lib/listing-request-artwork-limits";

/** Presigned direct-to-R2 source upload (bytes never pass through Vercel). */
export const LISTING_ARTWORK_V2_SOURCE_MAX_BYTES = 50 * 1024 * 1024;

export const LISTING_ARTWORK_V2_SOURCE_MAX_MB = LISTING_ARTWORK_V2_SOURCE_MAX_BYTES / (1024 * 1024);

export {
  LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES,
  LISTING_ARTWORK_BLANKET_SOURCE_MAX_MB,
  listingArtworkSourceMaxBytesForPrintArea,
};

/** Compose editor zoom bounds. */
export const LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM = 0.15;
export const LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM = 4;

/** Client preview caps (tab OOM safe). */
export const LISTING_ARTWORK_V2_PREVIEW_MAX_LONG_EDGE = 480;
export const LISTING_ARTWORK_V2_PREVIEW_MAX_SOURCE_LONG_EDGE = 2400;

export {
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS as LISTING_ARTWORK_V2_SERVER_DECODE_MAX_PIXELS,
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES as LISTING_ARTWORK_V2_SERVER_DECODE_MAX_PIXELS_HIGH_RES,
};

export function listingArtworkUploadV2Enabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_LISTING_ARTWORK_V2?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function listingArtworkV2SourceWithinCap(
  bytes: number,
  maxSourceBytes: number = LISTING_ARTWORK_V2_SOURCE_MAX_BYTES,
): boolean {
  return bytes > 0 && bytes <= maxSourceBytes;
}

export function listingArtworkV2SourceCapError(
  maxSourceBytes: number = LISTING_ARTWORK_V2_SOURCE_MAX_BYTES,
): string {
  const maxMb = maxSourceBytes / (1024 * 1024);
  return `Uploads are capped at ${maxMb} MB. Choose a smaller file.`;
}

export function listingArtworkV2DecodePixelsWithinCap(
  width: number,
  height: number,
  maxDecodePixels: number = LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS,
): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return width * height <= maxDecodePixels;
}

export function listingArtworkComposeSourceApiUrl(sourceKey: string): string {
  return `/api/dashboard/listing-artwork/source?sourceKey=${encodeURIComponent(sourceKey)}`;
}

/** Same-origin preview for post-bake listing-request artwork (shop dashboard only). */
export function listingArtworkBakedPreviewApiUrl(requestImageKey: string): string {
  return `/api/dashboard/listing-artwork/baked?requestImageKey=${encodeURIComponent(requestImageKey)}`;
}

export function listingArtworkV2DecodeCapError(
  width: number,
  height: number,
  maxDecodePixels: number = LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS,
): string {
  const mp = ((width * height) / 1_000_000).toFixed(1);
  const capMp = (maxDecodePixels / 1_000_000).toFixed(0);
  const highResHint =
    maxDecodePixels <= LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS
      ? " For large prints (blanket, body pillow), pick an item under Camera / vector only in the catalog."
      : maxDecodePixels < LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS
        ? " For 8192×8192 sources, use the velveteen blanket catalog item."
        : "";
  return `This image is ${mp} megapixels (${width}×${height}). The maximum for this item is about ${capMp} MP. Use a smaller export or resize before uploading.${highResHint}`;
}
