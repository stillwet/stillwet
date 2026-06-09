"use client";

import type {
  CatalogCanvasPresentation,
  ListingArtworkCropFrameRect,
} from "@/lib/admin-catalog-canvas-presentation";
import { catalogArtworkAssetPublicUrl } from "@/lib/admin-catalog-canvas-presentation";

export function ListingArtworkCanvasGuideOverlay({
  canvasPresentation,
  cropFrame,
}: {
  canvasPresentation: CatalogCanvasPresentation;
  cropFrame: ListingArtworkCropFrameRect | null;
}) {
  if (!cropFrame || canvasPresentation.type === "flat") return null;

  if (canvasPresentation.type === "shapeOutline") {
    const src = catalogArtworkAssetPublicUrl(canvasPresentation.outlineAssetKey);
    if (!src) return null;
    return (
      <div
        className="pointer-events-none absolute z-[2]"
        style={{
          left: cropFrame.left,
          top: cropFrame.top,
          width: cropFrame.width,
          height: cropFrame.height,
        }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain opacity-70"
          draggable={false}
        />
      </div>
    );
  }

  if (canvasPresentation.type !== "wraparound") return null;

  const { verticalGuideFractions } = canvasPresentation;

  return (
    <svg
      className="pointer-events-none absolute z-[2]"
      style={{
        left: cropFrame.left,
        top: cropFrame.top,
        width: cropFrame.width,
        height: cropFrame.height,
      }}
      aria-hidden
    >
      {verticalGuideFractions.map((fraction, i) => {
        const x = cropFrame.width * fraction;
        return (
          <g key={i}>
            <line
              x1={x}
              y1={-8}
              x2={x}
              y2={cropFrame.height + 8}
              stroke="rgba(250,250,250,0.45)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle cx={x} cy={-8} r={2} fill="rgba(250,250,250,0.55)" />
            <circle cx={x} cy={cropFrame.height + 8} r={2} fill="rgba(250,250,250,0.55)" />
          </g>
        );
      })}
    </svg>
  );
}
