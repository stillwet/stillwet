import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import {
  listingArtworkCropPreviewDimensions,
  renderListingArtworkCropCanvas,
} from "@/lib/listing-artwork-crop-canvas-client";
import type { ListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";

/** Display-only preview — not sent to the server. */
const PREVIEW_MAX_LONG_EDGE = 480;
/** Cap decoded source used for preview crop (avoids tab OOM). */
const PREVIEW_MAX_SOURCE_LONG_EDGE = 2400;

async function encodePreviewBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  for (const type of ["image/webp", "image/png"] as const) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), type, type === "image/webp" ? 0.85 : undefined);
    });
    if (blob) return blob;
  }
  return null;
}

/**
 * Low-resolution cropped preview for server-crop path (full print file is built on submit).
 * Uses the same crop math as {@link ListingArtworkCropDialog} export.
 */
export async function buildListingArtworkCropPreviewObjectUrl(
  imageSrc: string,
  crop: ListingArtworkCropPayload,
  letterboxFill?: ListingArtworkLetterboxFill | null,
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
    { maxSourceLongEdge: PREVIEW_MAX_SOURCE_LONG_EDGE, letterboxFill },
  );
  if (!canvas) return null;

  const blob = await encodePreviewBlob(canvas);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
