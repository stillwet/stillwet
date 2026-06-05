/** Shown when listing submit/upload cannot be confirmed after a server or transport failure. */
export const LISTING_UPLOAD_CRASH_ERROR =
  "process crashed while uploading. Please try again";

export function listingArtworkServerCropFailedError(): string {
  return "Could not apply your crop. Adjust the crop and try again, or use a smaller source file.";
}

export function listingArtworkServerProcessingError(storedMaxMb: number): string {
  return `Artwork could not be processed at print size. Try a simpler file or re-crop (stored files must fit within ${storedMaxMb} MB).`;
}
