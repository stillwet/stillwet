/** Crop frame size that fills a container at a fixed aspect (ignores source image dimensions). */
export function computeListingArtworkCropViewportSize(
  containerWidth: number,
  containerHeight: number,
  aspect: number,
): { width: number; height: number } | null {
  if (!(containerWidth > 0) || !(containerHeight > 0) || !(aspect > 0)) return null;
  const containerAspect = containerWidth / containerHeight;
  if (containerAspect > aspect) {
    return { width: containerHeight * aspect, height: containerHeight };
  }
  return { width: containerWidth, height: containerWidth / aspect };
}

/** Only very small sources get a viewport-sized crop frame; phone photos use react-easy-crop defaults. */
export const LISTING_ARTWORK_VIEWPORT_CROP_BOOST_MAX_NATURAL_LONG_EDGE = 480;

export function listingArtworkComposeCropSize(params: {
  viewportCropSize: { width: number; height: number } | null;
  naturalWidth: number;
  naturalHeight: number;
}): { width: number; height: number } | undefined {
  if (!params.viewportCropSize) return undefined;
  const naturalLong = Math.max(params.naturalWidth, params.naturalHeight);
  if (naturalLong > LISTING_ARTWORK_VIEWPORT_CROP_BOOST_MAX_NATURAL_LONG_EDGE) {
    return undefined;
  }
  return params.viewportCropSize;
}

/** Host fills a flex parent; crop frame size comes from {@link computeListingArtworkCropViewportSize}. */
export const LISTING_ARTWORK_CROP_PRINT_WINDOW_CLASS = "listing-artwork-crop-print-window";

/** Bounded measure band for crop viewport sizing (avoids flex-1 preview eating the dialog). */
export const LISTING_ARTWORK_CROP_PREVIEW_BAND_CLASS =
  "flex h-[min(52vh,460px)] w-full shrink-0 items-center justify-center overflow-hidden px-4 pt-3 pb-2";

/** Canvas wrap margin preview — semi-transparent crop mask + SVG bleed overlay. */
export const LISTING_ARTWORK_CROP_CANVAS_WRAP_PREVIEW_CLASS = "listing-artwork-crop-canvas-wrap-preview";

/** Mug wraparound — full print area is the crop box; no outer dimming mask. */
export const LISTING_ARTWORK_CROP_WRAPAROUND_PREVIEW_CLASS = "listing-artwork-crop-wraparound-preview";

export function listingArtworkCropPrintWindowClassNames(options: {
  showCanvasWrapMarginPreview: boolean;
  isWraparoundPreview: boolean;
}): string {
  const out = [LISTING_ARTWORK_CROP_PRINT_WINDOW_CLASS];
  if (options.showCanvasWrapMarginPreview) {
    out.push(LISTING_ARTWORK_CROP_CANVAS_WRAP_PREVIEW_CLASS);
  } else if (options.isWraparoundPreview) {
    out.push(LISTING_ARTWORK_CROP_WRAPAROUND_PREVIEW_CLASS);
  }
  out.push("relative", "shrink-0", "overflow-hidden");
  return out.join(" ");
}

/** @deprecated Use {@link LISTING_ARTWORK_CROP_CANVAS_WRAP_PREVIEW_CLASS}. */
export const LISTING_ARTWORK_CROP_CANVAS_BLEED_FRAME_CLASS = "listing-artwork-crop-canvas-bleed-frame";

/** Topmost crop preview layer — rounded corner darkening (above crop box + mug guides). */
export const LISTING_ARTWORK_ROUNDED_CORNER_CROP_GUIDE_CLASS = "listing-artwork-rounded-corner-crop-guide";
