"use client";

import type {
  CatalogCanvasPresentationWraparound,
  ListingArtworkCropFrameRect,
} from "@/lib/admin-catalog-canvas-presentation";
import {
  catalogArtworkAssetPublicUrl,
  guideXInContainer,
} from "@/lib/admin-catalog-canvas-presentation";

export function ListingArtworkWraparoundPreviews({
  presentation,
  cropFrame,
  containerWidth,
}: {
  presentation: CatalogCanvasPresentationWraparound;
  cropFrame: ListingArtworkCropFrameRect | null;
  containerWidth: number;
}) {
  if (!cropFrame || presentation.orientationPreviews.length === 0) return null;

  return (
    <div className="relative mt-1.5 h-16 w-full shrink-0" aria-hidden>
      {presentation.orientationPreviews.map((preview, i) => {
        const guideIndex = Math.min(
          Math.max(0, preview.alignGuideIndex),
          presentation.verticalGuideFractions.length - 1,
        );
        const fraction = presentation.verticalGuideFractions[guideIndex] ?? 0.5;
        const centerX = cropFrame ? guideXInContainer(cropFrame, fraction) : containerWidth / 2;
        const src = catalogArtworkAssetPublicUrl(preview.assetKey);
        return (
          <div
            key={`${preview.assetKey}-${i}`}
            className="absolute top-0 flex w-14 -translate-x-1/2 flex-col items-center gap-0.5"
            style={{ left: centerX }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-12 w-12 object-contain opacity-90" draggable={false} />
            {preview.label ? (
              <span className="text-[9px] uppercase tracking-wide text-zinc-500">{preview.label}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
