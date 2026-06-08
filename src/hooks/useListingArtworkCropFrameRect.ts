"use client";

import { useLayoutEffect, useState } from "react";
import {
  computeListingArtworkCropFrameRect,
  type ListingArtworkCropFrameRect,
} from "@/lib/admin-catalog-canvas-presentation";

function measureCropFrameFromDom(
  container: HTMLElement,
  aspect: number,
): { cropFrame: ListingArtworkCropFrameRect | null; cropAreaEl: HTMLElement | null } {
  const containerRect = container.getBoundingClientRect();
  const hostWidth = container.clientWidth;
  const hostHeight = container.clientHeight;
  const cropArea = container.querySelector<HTMLElement>(".reactEasyCrop_CropArea");
  if (cropArea) {
    const areaRect = cropArea.getBoundingClientRect();
    if (areaRect.width > 0 && areaRect.height > 0) {
      const left = areaRect.left - containerRect.left;
      const top = areaRect.top - containerRect.top;
      const right = left + areaRect.width;
      const bottom = top + areaRect.height;
      const extendsPastHost =
        left < -0.5 ||
        top < -0.5 ||
        right > hostWidth + 0.5 ||
        bottom > hostHeight + 0.5;
      if (extendsPastHost && hostWidth > 0 && hostHeight > 0) {
        return {
          cropAreaEl: cropArea,
          cropFrame: { left: 0, top: 0, width: hostWidth, height: hostHeight },
        };
      }
      return {
        cropAreaEl: cropArea,
        cropFrame: {
          left,
          top,
          width: areaRect.width,
          height: areaRect.height,
        },
      };
    }
  }
  if (hostWidth > 0 && hostHeight > 0) {
    return {
      cropAreaEl: cropArea,
      cropFrame: { left: 0, top: 0, width: hostWidth, height: hostHeight },
    };
  }
  return {
    cropAreaEl: cropArea,
    cropFrame: computeListingArtworkCropFrameRect(containerRect.width, containerRect.height, aspect),
  };
}

export type ListingArtworkCropFrameMeasurement = {
  cropFrame: ListingArtworkCropFrameRect | null;
  cropAreaEl: HTMLElement | null;
};

/** Tracks crop frame geometry inside the compose/crop container (matches react-easy-crop crop area). */
export function useListingArtworkCropFrameRect(
  containerRef: React.RefObject<HTMLElement | null>,
  aspect: number,
  remeasureDeps: readonly unknown[] = [],
): ListingArtworkCropFrameMeasurement {
  const [measurement, setMeasurement] = useState<ListingArtworkCropFrameMeasurement>({
    cropFrame: null,
    cropAreaEl: null,
  });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setMeasurement(measureCropFrameFromDom(el, aspect));
      });
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    const mo = new MutationObserver(update);
    mo.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [containerRef, aspect, ...remeasureDeps]);

  return measurement;
}
