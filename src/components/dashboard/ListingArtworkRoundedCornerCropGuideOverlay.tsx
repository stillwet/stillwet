"use client";

import { useId, useLayoutEffect, useState } from "react";
import type { ListingArtworkCropFrameRect } from "@/lib/admin-catalog-canvas-presentation";
import {
  ROUNDED_CORNER_CROP_OVERLAY_FILL,
  roundedCornerCropRadiusPx,
} from "@/lib/listing-artwork-playing-card-crop";

function printWindowFrameFromSize(size: { width: number; height: number } | null | undefined) {
  if (!size || !(size.width > 0) || !(size.height > 0)) return null;
  return { left: 0, top: 0, width: size.width, height: size.height } satisfies ListingArtworkCropFrameRect;
}

/** Visible crop host box — not react-easy-crop's internal crop area rect (can drift negative). */
function usePrintWindowCropFrame(
  containerRef: React.RefObject<HTMLElement | null> | undefined,
  fallbackSize: { width: number; height: number } | null | undefined,
): ListingArtworkCropFrameRect | null {
  const [frame, setFrame] = useState<ListingArtworkCropFrameRect | null>(() =>
    printWindowFrameFromSize(fallbackSize),
  );

  useLayoutEffect(() => {
    const el = containerRef?.current;
    if (!el) {
      setFrame(printWindowFrameFromSize(fallbackSize));
      return;
    }

    const update = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width > 0 && height > 0) {
        setFrame({ left: 0, top: 0, width, height });
      } else {
        setFrame(printWindowFrameFromSize(fallbackSize));
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, fallbackSize?.width, fallbackSize?.height]);

  return frame;
}

/**
 * Corner darkening over the crop preview — same sibling-SVG + mask pattern as playing cards.
 * Aligned to the visible print window (overflow:hidden host), not DOM crop-area offsets.
 * Visual guide only; not exported with the artwork.
 */
export function ListingArtworkRoundedCornerCropGuideOverlay({
  containerRef,
  fallbackSize = null,
}: {
  containerRef?: React.RefObject<HTMLElement | null>;
  fallbackSize?: { width: number; height: number } | null;
}) {
  const cornerMaskId = useId();
  const frame = usePrintWindowCropFrame(containerRef, fallbackSize);
  if (!frame) return null;

  const { width, height } = frame;
  const radius = roundedCornerCropRadiusPx(width, height);
  if (!(radius > 0)) return null;

  return (
    <svg
      className="pointer-events-none absolute z-[2]"
      style={{
        left: 0,
        top: 0,
        width,
        height,
      }}
      aria-hidden
    >
      <defs>
        <mask id={cornerMaskId}>
          <rect x={0} y={0} width={width} height={height} fill="white" />
          <rect x={0} y={0} width={width} height={height} rx={radius} ry={radius} fill="black" />
        </mask>
      </defs>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={ROUNDED_CORNER_CROP_OVERLAY_FILL}
        mask={`url(#${cornerMaskId})`}
      />
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={radius}
        ry={radius}
        fill="none"
        stroke="rgba(250,250,250,0.35)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
    </svg>
  );
}
