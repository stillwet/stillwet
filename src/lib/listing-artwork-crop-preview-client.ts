import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import {
  listingArtworkCropPreviewDimensions,
  renderListingArtworkCropCanvas,
} from "@/lib/listing-artwork-crop-canvas-client";

/** Display-only preview — not sent to the server. */
const PREVIEW_MAX_LONG_EDGE = 480;
/** Cap decoded source used for preview crop (avoids tab OOM). */
const PREVIEW_MAX_SOURCE_LONG_EDGE = 2400;

/**
 * Low-resolution cropped preview for server-crop path (full print file is built on submit).
 * Uses the same crop math as {@link ListingArtworkCropDialog} export.
 */
export async function buildListingArtworkCropPreviewObjectUrl(
  imageSrc: string,
  crop: ListingArtworkCropPayload,
): Promise<string | null> {
  const { pixelCrop, rotation, printWidthPx, printHeightPx } = crop;
  const { width: outW, height: outH } = listingArtworkCropPreviewDimensions(
    printWidthPx,
    printHeightPx,
    PREVIEW_MAX_LONG_EDGE,
  );

  const canvas = await renderListingArtworkCropCanvas(
    imageSrc,
    pixelCrop,
    outW,
    outH,
    rotation,
    { maxSourceLongEdge: PREVIEW_MAX_SOURCE_LONG_EDGE },
  );
  if (!canvas) return null;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
  });
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
