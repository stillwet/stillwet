import {
  LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES,
  listingRequestArtworkUploadMaxBytes,
} from "@/lib/listing-request-artwork-limits";

/** Number of HTTP chunk uploads needed for a file of `byteSize`. */
export function listingArtworkStagingChunkCount(byteSize: number): number {
  if (!Number.isFinite(byteSize) || byteSize <= 0) return 0;
  return Math.ceil(byteSize / LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES);
}

export function listingArtworkStagingMaxParts(): number {
  return listingArtworkStagingChunkCount(listingRequestArtworkUploadMaxBytes()) + 2;
}

/** Byte range `[start, end)` for chunk `partIndex` of a file with `byteSize`. */
export function listingArtworkStagingChunkRange(
  byteSize: number,
  partIndex: number,
): { start: number; end: number } | null {
  if (!Number.isFinite(byteSize) || byteSize <= 0 || partIndex < 0) return null;
  const start = partIndex * LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES;
  if (start >= byteSize) return null;
  return { start, end: Math.min(byteSize, start + LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES) };
}
