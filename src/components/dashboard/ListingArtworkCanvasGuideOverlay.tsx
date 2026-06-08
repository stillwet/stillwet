"use client";

import { useId } from "react";
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
  const bleedMaskId = useId();
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

  const { verticalGuideFractions, safeAreaInsetFraction } = canvasPresentation;
  const insetX = safeAreaInsetFraction?.x ?? 0;
  const insetY = safeAreaInsetFraction?.y ?? 0;

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
      {insetX > 0 || insetY > 0 ? (
        <>
          <defs>
            <mask id={bleedMaskId}>
              <rect x={0} y={0} width={cropFrame.width} height={cropFrame.height} fill="white" />
              <rect
                x={cropFrame.width * insetX}
                y={cropFrame.height * insetY}
                width={cropFrame.width * (1 - 2 * insetX)}
                height={cropFrame.height * (1 - 2 * insetY)}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x={0}
            y={0}
            width={cropFrame.width}
            height={cropFrame.height}
            fill="rgba(39,39,42,0.82)"
            mask={`url(#${bleedMaskId})`}
          />
          <rect
            x={cropFrame.width * insetX}
            y={cropFrame.height * insetY}
            width={cropFrame.width * (1 - 2 * insetX)}
            height={cropFrame.height * (1 - 2 * insetY)}
            fill="none"
            stroke="rgba(250,250,250,0.45)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </>
      ) : (
        <rect
          x={0}
          y={0}
          width={cropFrame.width}
          height={cropFrame.height}
          fill="none"
          stroke="rgba(113,113,122,0.55)"
          strokeWidth={1}
        />
      )}
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
