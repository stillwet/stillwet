import { useEffect, useRef, useState } from "react";

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

/** Measure crop viewport from a container ref; keeps print canvas large even for tiny uploads. */
export function useListingArtworkCropViewportSize(aspect: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const next = computeListingArtworkCropViewportSize(rect.width, rect.height, aspect);
      setCropSize((prev) => {
        if (!next) return prev;
        if (prev?.width === next.width && prev?.height === next.height) return prev;
        return next;
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  return { containerRef, cropSize };
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
