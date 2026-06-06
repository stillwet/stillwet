"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import {
  effectiveArtworkDpiFromCropAndPrint,
  listingArtworkEffectiveDpiBlockError,
  listingArtworkEffectiveDpiBelowRequired,
  listingArtworkEffectiveDpiUpscaleWarning,
  listingArtworkRequiredEffectiveDpi,
  PRINT_AREA_REFERENCE_DPI,
} from "@/lib/listing-artwork-print-area";
import {
  listingArtworkLetterboxPreviewStyle,
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";
import {
  LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM,
  LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM,
} from "@/lib/listing-artwork-v2/limits";
import { buildListingArtworkV2PreviewObjectUrl } from "@/lib/listing-artwork-v2/preview-client";
import type { ListingArtworkTransformV2 } from "@/lib/listing-artwork-v2/transform";
import { listingArtworkCropPayloadToTransformV2 } from "@/lib/listing-artwork-v2/transform";
import { useListingArtworkCropViewportSize, listingArtworkComposeCropSize } from "@/lib/listing-artwork-crop-viewport";

export type ListingArtworkComposeCompleteResult = {
  transform: ListingArtworkTransformV2;
  previewUrl: string | null;
};

export function ListingArtworkComposeDialog({
  open,
  imageUrl,
  printWidthPx,
  printHeightPx,
  minArtworkDpi,
  artworkLetterboxFill,
  onClose,
  onComplete,
}: {
  open: boolean;
  imageUrl: string;
  printWidthPx: number;
  printHeightPx: number;
  minArtworkDpi: number | null;
  artworkLetterboxFill: ListingArtworkLetterboxFill;
  onClose: () => void;
  onComplete: (result: ListingArtworkComposeCompleteResult) => void;
}) {
  const aspect = printWidthPx / printHeightPx;
  const letterboxPreviewStyle = useMemo(
    () => listingArtworkLetterboxPreviewStyle(artworkLetterboxFill),
    [artworkLetterboxFill],
  );
  const { containerRef, cropSize } = useListingArtworkCropViewportSize(aspect);
  const cropperContainerStyle = useMemo(
    () => ({
      ...letterboxPreviewStyle,
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    }),
    [letterboxPreviewStyle],
  );

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [mediaNatural, setMediaNatural] = useState<{ width: number; height: number } | null>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livePreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setImageLoadError(null);
    const img = new Image();
    img.onload = () => setImageLoadError(null);
    img.onerror = () => {
      setImageLoadError(
        "Could not load this image for placement. Try a smaller export, or use PNG/JPEG instead of an unusual format.",
      );
    };
    img.src = imageUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [open, imageUrl]);

  useEffect(() => {
    if (open) {
      setRotation(0);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
      setApplyError(null);
      setLivePreviewUrl(null);
      setMediaNatural(null);
      livePreviewUrlRef.current = null;
    }
  }, [open, imageUrl]);

  const composeCropSize = useMemo(
    () =>
      mediaNatural
        ? listingArtworkComposeCropSize({
            viewportCropSize: cropSize,
            naturalWidth: mediaNatural.width,
            naturalHeight: mediaNatural.height,
          })
        : cropSize ?? undefined,
    [cropSize, mediaNatural],
  );

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixelsInner: Area) => {
    setCroppedAreaPixels(croppedAreaPixelsInner);
    setApplyError(null);
  }, []);

  const effectiveDpi = useMemo(() => {
    if (!croppedAreaPixels) return null;
    return effectiveArtworkDpiFromCropAndPrint(
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      printWidthPx,
      printHeightPx,
    );
  }, [croppedAreaPixels, printWidthPx, printHeightPx]);

  const requiredEffectiveDpi = listingArtworkRequiredEffectiveDpi(minArtworkDpi);
  const effectiveDpiBelowMin = listingArtworkEffectiveDpiBelowRequired(effectiveDpi, minArtworkDpi);
  const upscaleSoftWarning = listingArtworkEffectiveDpiUpscaleWarning(effectiveDpi, minArtworkDpi);

  useEffect(() => {
    if (!open || !croppedAreaPixels) return;

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      void (async () => {
        const transform: ListingArtworkTransformV2 = {
          v: 2,
          pixelCrop: {
            x: croppedAreaPixels.x,
            y: croppedAreaPixels.y,
            width: croppedAreaPixels.width,
            height: croppedAreaPixels.height,
          },
          rotation,
          printWidthPx,
          printHeightPx,
          letterboxFill: artworkLetterboxFill,
        };
        const url = await buildListingArtworkV2PreviewObjectUrl(imageUrl, transform);
        if (livePreviewUrlRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(livePreviewUrlRef.current);
        }
        livePreviewUrlRef.current = url;
        setLivePreviewUrl(url);
      })();
    }, 120);

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [
    open,
    croppedAreaPixels,
    rotation,
    printWidthPx,
    printHeightPx,
    artworkLetterboxFill,
    imageUrl,
  ]);

  useEffect(() => {
    return () => {
      if (livePreviewUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(livePreviewUrlRef.current);
      }
    };
  }, []);

  async function apply() {
    setApplyError(null);
    if (imageLoadError) {
      setApplyError(imageLoadError);
      return;
    }
    if (!croppedAreaPixels) {
      setApplyError("Adjust the placement, then try again.");
      return;
    }
    if (!(croppedAreaPixels.width > 0) || !(croppedAreaPixels.height > 0)) {
      setApplyError("Adjust the placement, then try again.");
      return;
    }
    if (effectiveDpi == null) {
      setApplyError("Could not read crop size. Adjust the placement and try again.");
      return;
    }
    if (requiredEffectiveDpi != null && effectiveDpi + 0.01 < requiredEffectiveDpi) {
      setApplyError(listingArtworkEffectiveDpiBlockError(effectiveDpi, requiredEffectiveDpi));
      return;
    }

    setBusy(true);
    try {
      const cropPayload = {
        pixelCrop: {
          x: croppedAreaPixels.x,
          y: croppedAreaPixels.y,
          width: croppedAreaPixels.width,
          height: croppedAreaPixels.height,
        },
        rotation,
        printWidthPx,
        printHeightPx,
      };
      const transform = listingArtworkCropPayloadToTransformV2(cropPayload, artworkLetterboxFill);
      let previewUrl = livePreviewUrl;
      if (!previewUrl) {
        previewUrl = await buildListingArtworkV2PreviewObjectUrl(imageUrl, transform);
      }
      onComplete({ transform, previewUrl });
    } catch {
      setApplyError("Could not build preview. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-artwork-compose-title"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 id="listing-artwork-compose-title" className="text-sm font-semibold text-zinc-100">
            Place artwork on print canvas
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Print size {printWidthPx}×{printHeightPx}px — drag to move, zoom to scale.
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-[1fr_min(200px,35%)]">
          <div
            ref={containerRef}
            className="relative h-[min(60vh,520px)] min-h-[280px] w-full"
            style={letterboxPreviewStyle}
          >
            <Cropper
                key={imageUrl}
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                {...(composeCropSize ? { cropSize: composeCropSize } : {})}
                onCropChange={setCrop}
                onZoomChange={(z) =>
                  setZoom(
                    Math.min(LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM, Math.max(LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM, z)),
                  )
                }
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                onMediaLoaded={(mediaSize) => {
                  setMediaNatural({
                    width: mediaSize.naturalWidth,
                    height: mediaSize.naturalHeight,
                  });
                  setImageLoadError(null);
                }}
                restrictPosition={false}
                minZoom={LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM}
                maxZoom={LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM}
                style={{ containerStyle: cropperContainerStyle }}
              />
            {imageLoadError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 px-4 text-center text-xs text-amber-200/90">
                {imageLoadError}
              </div>
            ) : null}
          </div>
          {livePreviewUrl ? (
            <div className="hidden border-l border-zinc-800 p-3 md:block">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">Preview</p>
              <div
                className="overflow-hidden rounded-lg border border-zinc-700"
                style={letterboxPreviewStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={livePreviewUrl} alt="" className="max-h-48 w-full object-contain" />
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Rotate</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRotation((r) => ((r - 90 + 360 * 4) % 360));
                setApplyError(null);
              }}
              className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              ⟲ 90°
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRotation((r) => (r + 90) % 360);
                setApplyError(null);
              }}
              className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              ⟳ 90°
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM}
              max={LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM}
              step={0.02}
              value={zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                setZoom(
                  Math.min(LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM, Math.max(LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM, z)),
                );
              }}
              className="min-w-0 flex-1"
            />
          </label>
          {upscaleSoftWarning && effectiveDpi != null ? (
            <p className="text-xs text-amber-200/80" role="status">
              Below {PRINT_AREA_REFERENCE_DPI} DPI (~{Math.round(effectiveDpi)}) — we will upscale to print size.
              Print may look soft.
            </p>
          ) : null}
          {applyError ? (
            <p className="text-xs text-amber-200/90" role="alert">
              {applyError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p
              className={`min-w-0 text-xs tabular-nums ${effectiveDpiBelowMin ? "text-amber-200/90" : "text-zinc-500"}`}
              aria-live="polite"
            >
              {effectiveDpi != null ? (
                <>
                  Effective DPI: ~{Math.round(effectiveDpi)}
                  {requiredEffectiveDpi != null ? (
                    <span className={effectiveDpiBelowMin ? "text-amber-200/80" : "text-zinc-600"}>
                      {" "}
                      (min {requiredEffectiveDpi})
                    </span>
                  ) : (
                    <span className="text-zinc-600"> (ref {PRINT_AREA_REFERENCE_DPI})</span>
                  )}
                </>
              ) : (
                <>Effective DPI: —</>
              )}
            </p>
            <div className="flex shrink-0 justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
                onClick={() => void apply()}
              >
                {busy ? "Saving…" : "Prepare print file"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
