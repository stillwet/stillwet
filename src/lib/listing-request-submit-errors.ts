/** Shown when listing submit/upload cannot be confirmed after a server or transport failure. */
export const LISTING_UPLOAD_CRASH_ERROR =
  "process crashed while uploading. Please try again";

export function listingArtworkServerCropFailedError(): string {
  return "Could not apply your crop. Adjust the crop and try again, or use a smaller source file.";
}

export function listingArtworkServerProcessingError(storedMaxMb: number): string {
  return `Artwork could not be processed at print size. Try a simpler file or re-crop (stored files must fit within ${storedMaxMb} MB).`;
}

export function listingArtworkBakeFailureMessage(
  stage: string,
  storedMaxMb: number,
): string {
  switch (stage) {
    case "metadata":
      return "Could not read that image. Try PNG or JPEG.";
    case "decode_cap":
      return "That image is too large to process for this item. Try a smaller photo or pick a different print size.";
    case "encode":
      return listingArtworkServerProcessingError(storedMaxMb);
    case "input_too_large":
      return "Uploaded artwork exceeds the upload size limit. Try a smaller file.";
    case "rotate":
    case "region":
    case "print":
    case "dimensions":
      return listingArtworkServerCropFailedError();
    default:
      return listingArtworkServerProcessingError(storedMaxMb);
  }
}
