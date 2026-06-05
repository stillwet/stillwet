import type { ListingArtworkTransformV2 } from "@/lib/listing-artwork-v2/transform";
import {
  LISTING_ARTWORK_V2_PREVIEW_MAX_LONG_EDGE,
  LISTING_ARTWORK_V2_PREVIEW_MAX_SOURCE_LONG_EDGE,
} from "@/lib/listing-artwork-v2/limits";
import {
  listingArtworkCropPreviewDimensions,
  renderListingArtworkCropCanvas,
} from "@/lib/listing-artwork-crop-canvas-client";
import { listingArtworkTransformV2ToCropPayload } from "@/lib/listing-artwork-v2/transform";

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
 * Capped live preview for v2 compose (480px out, 2400px source decode max).
 */
export async function buildListingArtworkV2PreviewObjectUrl(
  imageSrc: string,
  transform: ListingArtworkTransformV2,
): Promise<string | null> {
  const crop = listingArtworkTransformV2ToCropPayload(transform);
  const { width: outW, height: outH } = listingArtworkCropPreviewDimensions(
    transform.printWidthPx,
    transform.printHeightPx,
    LISTING_ARTWORK_V2_PREVIEW_MAX_LONG_EDGE,
  );

  const canvas = await renderListingArtworkCropCanvas(
    imageSrc,
    crop.pixelCrop,
    outW,
    outH,
    crop.rotation,
    {
      maxSourceLongEdge: LISTING_ARTWORK_V2_PREVIEW_MAX_SOURCE_LONG_EDGE,
      letterboxFill: transform.letterboxFill,
    },
  );
  if (!canvas) return null;

  const blob = await encodePreviewBlob(canvas);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export { LISTING_ARTWORK_V2_PREVIEW_MAX_LONG_EDGE, LISTING_ARTWORK_V2_PREVIEW_MAX_SOURCE_LONG_EDGE };
