"use client";

import { useEffect, useRef, useState } from "react";
import { computeListingArtworkCropViewportSize } from "@/lib/listing-artwork-crop-viewport";

/** Measure available preview space and derive a print-aspect crop host size. */
export function useListingArtworkCropViewportSize(aspect: number) {
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = previewAreaRef.current;
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

  return { previewAreaRef, containerRef, cropSize };
}
