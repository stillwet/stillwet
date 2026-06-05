/** Shown when listing submit/upload cannot be confirmed after a server or transport failure. */
export const LISTING_UPLOAD_CRASH_ERROR =
  "process crashed while uploading. Please try again";

export function listingArtworkServerProcessingError(storedMaxMb: number): string {
  return `Artwork is too large for the server to process at print size. Re-crop or use a simpler file (max ${storedMaxMb} MB after crop).`;
}
