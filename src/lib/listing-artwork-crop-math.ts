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

/**
 * Maps bbox-space crop coords onto a print-sized canvas — same math as server bake and
 * {@link renderListingArtworkCropCanvas}.
 */
export function cropCompositePlacementOnPrint(
  rotatedWidthPx: number,
  rotatedHeightPx: number,
  crop: ListingArtworkCropArea,
  printWidthPx: number,
  printHeightPx: number,
): { left: number; top: number; scaledWidthPx: number; scaledHeightPx: number } {
  const cropWidthPx = crop.width;
  const cropHeightPx = crop.height;
  return {
    left: Math.round((-crop.x / cropWidthPx) * printWidthPx),
    top: Math.round((-crop.y / cropHeightPx) * printHeightPx),
    scaledWidthPx: Math.max(1, Math.round((rotatedWidthPx / cropWidthPx) * printWidthPx)),
    scaledHeightPx: Math.max(1, Math.round((rotatedHeightPx / cropHeightPx) * printHeightPx)),
  };
}

/** Clip a layer to the print canvas, matching browser drawImage overflow behavior. */
export function visibleCompositeSlice(params: {
  left: number;
  top: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}): { destLeft: number; destTop: number; srcLeft: number; srcTop: number; width: number; height: number } | null {
  const visibleLeft = Math.max(0, params.left);
  const visibleTop = Math.max(0, params.top);
  const visibleRight = Math.min(params.canvasWidth, params.left + params.width);
  const visibleBottom = Math.min(params.canvasHeight, params.top + params.height);
  const width = visibleRight - visibleLeft;
  const height = visibleBottom - visibleTop;
  if (width < 1 || height < 1) return null;
  return {
    destLeft: visibleLeft,
    destTop: visibleTop,
    srcLeft: visibleLeft - params.left,
    srcTop: visibleTop - params.top,
    width,
    height,
  };
}
