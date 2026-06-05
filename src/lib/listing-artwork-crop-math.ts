/** Crop rectangle from react-easy-crop (pixels in rotated-image bounding-box space). */
export type ListingArtworkCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Bounding box of a `width`×`height` rectangle rotated by `rotationDeg` (react-easy-crop). */
export function listingArtworkRotateSize(
  width: number,
  height: number,
  rotationDeg: number,
): { width: number; height: number } {
  const rotRad = (rotationDeg * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

function roundCropArea(area: ListingArtworkCropArea): ListingArtworkCropArea | null {
  const { x, y, width, height } = area;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;

  // Keep the cropper region as-is (may extend past bbox for zoomed-out letterbox). Out-of-bounds
  // pixels are transparent on the browser canvas and padded on the server.
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

/**
 * Map react-easy-crop bbox coordinates onto the rotated image sharp produced,
 * preserving print aspect ratio so resize to print pixels does not squash.
 */
export function listingArtworkCropExtractRegionForRotatedImage(params: {
  pixelCrop: ListingArtworkCropArea;
  sourceWidthPx: number;
  sourceHeightPx: number;
  rotationDeg: number;
  rotatedWidthPx: number;
  rotatedHeightPx: number;
  printWidthPx: number;
  printHeightPx: number;
}): ListingArtworkCropArea | null {
  const expected = listingArtworkRotateSize(params.sourceWidthPx, params.sourceHeightPx, params.rotationDeg);
  const expW = Math.max(1, Math.round(expected.width));
  const expH = Math.max(1, Math.round(expected.height));
  const scaleX = params.rotatedWidthPx / expW;
  const scaleY = params.rotatedHeightPx / expH;

  const scaled: ListingArtworkCropArea = {
    x: params.pixelCrop.x * scaleX,
    y: params.pixelCrop.y * scaleY,
    width: params.pixelCrop.width * scaleX,
    height: params.pixelCrop.height * scaleY,
  };

  // Aspect ratio is already enforced by the cropper (`aspect` prop). We keep exactly what the UI requested.
  return roundCropArea(scaled);
}
