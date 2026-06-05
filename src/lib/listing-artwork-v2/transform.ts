import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import type { ListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";

export const LISTING_ARTWORK_TRANSFORM_V2 = 2 as const;

export type ListingArtworkTransformV2 = {
  v: typeof LISTING_ARTWORK_TRANSFORM_V2;
  pixelCrop: { x: number; y: number; width: number; height: number };
  rotation: number;
  printWidthPx: number;
  printHeightPx: number;
  letterboxFill: ListingArtworkLetterboxFill;
};

export function parseListingArtworkTransformV2(raw: unknown): ListingArtworkTransformV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const v = Number(o.v);
  if (v !== LISTING_ARTWORK_TRANSFORM_V2) return null;

  const pixelCrop = o.pixelCrop;
  if (!pixelCrop || typeof pixelCrop !== "object") return null;
  const c = pixelCrop as Record<string, unknown>;
  const x = Number(c.x);
  const y = Number(c.y);
  const width = Number(c.width);
  const height = Number(c.height);
  const rotation = Number(o.rotation);
  const printWidthPx = Number(o.printWidthPx);
  const printHeightPx = Number(o.printHeightPx);
  const letterboxFillRaw = String(o.letterboxFill ?? "").trim();

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(rotation) ||
    !Number.isFinite(printWidthPx) ||
    !Number.isFinite(printHeightPx) ||
    printWidthPx <= 0 ||
    printHeightPx <= 0
  ) {
    return null;
  }

  const letterboxFill =
    letterboxFillRaw === "white" || letterboxFillRaw === "transparent"
      ? letterboxFillRaw
      : null;
  if (!letterboxFill) return null;

  return {
    v: LISTING_ARTWORK_TRANSFORM_V2,
    pixelCrop: { x, y, width, height },
    rotation,
    printWidthPx: Math.round(printWidthPx),
    printHeightPx: Math.round(printHeightPx),
    letterboxFill,
  };
}

/** Server crop pipeline uses v1 crop payload shape. */
export function listingArtworkTransformV2ToCropPayload(
  transform: ListingArtworkTransformV2,
): ListingArtworkCropPayload {
  return {
    pixelCrop: transform.pixelCrop,
    rotation: transform.rotation,
    printWidthPx: transform.printWidthPx,
    printHeightPx: transform.printHeightPx,
  };
}

export function listingArtworkCropPayloadToTransformV2(
  crop: ListingArtworkCropPayload,
  letterboxFill: ListingArtworkLetterboxFill,
): ListingArtworkTransformV2 {
  return {
    v: LISTING_ARTWORK_TRANSFORM_V2,
    pixelCrop: crop.pixelCrop,
    rotation: crop.rotation,
    printWidthPx: crop.printWidthPx,
    printHeightPx: crop.printHeightPx,
    letterboxFill,
  };
}
