import { LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS } from "@/lib/listing-request-artwork-limits";

/** Presigned direct-to-R2 source upload (bytes never pass through Vercel). */
export const LISTING_ARTWORK_V2_SOURCE_MAX_BYTES = 50 * 1024 * 1024;

export const LISTING_ARTWORK_V2_SOURCE_MAX_MB = LISTING_ARTWORK_V2_SOURCE_MAX_BYTES / (1024 * 1024);

/** Compose editor zoom bounds. */
export const LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM = 0.15;
export const LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM = 4;

/** Client preview caps (tab OOM safe). */
export const LISTING_ARTWORK_V2_PREVIEW_MAX_LONG_EDGE = 480;
export const LISTING_ARTWORK_V2_PREVIEW_MAX_SOURCE_LONG_EDGE = 2400;

export { LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS as LISTING_ARTWORK_V2_SERVER_DECODE_MAX_PIXELS };

export function listingArtworkUploadV2Enabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_LISTING_ARTWORK_V2?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function listingArtworkV2SourceWithinCap(bytes: number): boolean {
  return bytes > 0 && bytes <= LISTING_ARTWORK_V2_SOURCE_MAX_BYTES;
}

export function listingArtworkV2SourceCapError(): string {
  return `Uploads are capped at ${LISTING_ARTWORK_V2_SOURCE_MAX_MB} MB. Choose a smaller file.`;
}

export function listingArtworkV2DecodePixelsWithinCap(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return width * height <= LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS;
}

export function listingArtworkV2DecodeCapError(width: number, height: number): string {
  const mp = ((width * height) / 1_000_000).toFixed(1);
  const capMp = (LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS / 1_000_000).toFixed(0);
  return `This image is ${mp} megapixels (${width}×${height}). The maximum is about ${capMp} MP. Use a smaller export or resize before uploading.`;
}
