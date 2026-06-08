"use client";

import { useEffect } from "react";
import { sampleColorFromCropPreviewClick } from "@/lib/listing-artwork-crop-color-sample";

/** Click-to-sample overlay for canvas solid side color. */
export function ListingArtworkCanvasColorPickOverlay({
  containerRef,
  onPick,
  onCancel,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onPick: (hex: string) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-[30] cursor-crosshair bg-black/10"
      role="button"
      tabIndex={0}
      aria-label="Pick a color from the artwork"
      onClick={(event) => {
        const container = containerRef.current;
        if (!container) return;
        void sampleColorFromCropPreviewClick(container, event.clientX, event.clientY).then((hex) => {
          if (hex) onPick(hex);
        });
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <p className="pointer-events-none absolute inset-x-0 top-1.5 px-2 text-center text-[11px] leading-snug text-zinc-100 drop-shadow">
        Click the artwork to pick a side color · Esc to cancel
      </p>
    </div>
  );
}
