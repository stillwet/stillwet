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
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import {
  LISTING_ARTWORK_V2_COMPOSE_MAX_ZOOM,
  LISTING_ARTWORK_V2_COMPOSE_MIN_ZOOM,
} from "@/lib/listing-artwork-v2/limits";
import { buildListingArtworkV2PreviewObjectUrl } from "@/lib/listing-artwork-v2/preview-client";
import type { ListingArtworkTransformV2 } from "@/lib/listing-artwork-v2/transform";
import { listingArtworkCropPayloadToTransformV2 } from "@/lib/listing-artwork-v2/transform";
import { useListingArtworkCropViewportSize } from "@/hooks/useListingArtworkCropViewportSize";
import type { CatalogCanvasPresentation } from "@/lib/admin-catalog-canvas-presentation";
import { CATALOG_CANVAS_PRESENTATION_FLAT } from "@/lib/admin-catalog-canvas-presentation";
import {
  listingArtworkComposeCropSize,
  LISTING_ARTWORK_CROP_PREVIEW_BAND_CLASS,
  LISTING_ARTWORK_CROP_CANVAS_WRAP_PREVIEW_CLASS,
  LISTING_ARTWORK_CROP_PRINT_WINDOW_CLASS,
} from "@/lib/listing-artwork-crop-viewport";
import { ListingArtworkCanvasGuideOverlay } from "@/components/dashboard/ListingArtworkCanvasGuideOverlay";
import { ListingArtworkCanvasColorPickOverlay } from "@/components/dashboard/ListingArtworkCanvasColorPickOverlay";
import { ListingArtworkRoundedCornerCropGuideOverlay } from "@/components/dashboard/ListingArtworkRoundedCornerCropGuideOverlay";
import {
  CANVAS_SOLID_SIDE_DEFAULT_HEX,
  canvasWrapBleedPreviewStyleVars,
} from "@/lib/listing-artwork-canvas-wrap-bleed";
import {
  canvasSideTreatmentShowsWrapMarginPreview,
  ListingCanvasSideTreatmentFields,
  type CanvasSideTreatment,
} from "@/components/dashboard/ListingCanvasSideTreatmentFields";
import { ListingArtworkWraparoundPreviews } from "@/components/dashboard/ListingArtworkWraparoundPreviews";
import { useListingArtworkCropFrameRect } from "@/hooks/useListingArtworkCropFrameRect";
import { listingArtworkCropShowsRoundedCornerGuide } from "@/lib/listing-artwork-playing-card-crop";

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
  isCanvasPrintItem = false,
  showBlackMugBackgroundTip = false,
  showWhiteMugBackgroundTip = false,
  showRoundedCornerCropGuide = false,
  catalogItemName = null,
  categoryTagSlug = null,
  canvasPresentation = CATALOG_CANVAS_PRESENTATION_FLAT,
  surfaceLabel,
  onClose,
  onComplete,
}: {
  open: boolean;
  imageUrl: string;
  printWidthPx: number;
  printHeightPx: number;
  minArtworkDpi: number | null;
  artworkLetterboxFill: ListingArtworkLetterboxFill;
  /** Stretched canvas print — shows wrap-bleed frame + helper copy under zoom. */
  isCanvasPrintItem?: boolean;
  /** Black mug — transparent PNG guidance under the crop preview. */
  showBlackMugBackgroundTip?: boolean;
  /** White mug — white is not printed; white backgrounds are OK. */
  showWhiteMugBackgroundTip?: boolean;
  /** Playing cards, mousepads, desk mats — darkens rounded corners to show visible print face. */
  showRoundedCornerCropGuide?: boolean;
  catalogItemName?: string | null;
  categoryTagSlug?: string | null;
  canvasPresentation?: CatalogCanvasPresentation;
  surfaceLabel?: string;
  onClose: () => void;
  onComplete: (result: ListingArtworkComposeCompleteResult) => void;
}) {
  const aspect = printWidthPx / printHeightPx;
  const isWraparound = canvasPresentation.type === "wraparound";
  const letterboxPreviewStyle = useMemo(
    () => listingArtworkLetterboxPreviewStyle(artworkLetterboxFill),
    [artworkLetterboxFill],
  );
  const cropPreviewLetterboxStyle = useMemo(
    () =>
      isCanvasPrintItem
        ? listingArtworkLetterboxPreviewStyle(ListingArtworkLetterboxFill.white)
        : letterboxPreviewStyle,
    [isCanvasPrintItem, letterboxPreviewStyle],
  );
  const { previewAreaRef, containerRef, cropSize } = useListingArtworkCropViewportSize(aspect);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, open]);
  const cropperContainerStyle = useMemo(
    () => ({
      ...cropPreviewLetterboxStyle,
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    }),
    [cropPreviewLetterboxStyle],
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
  const [sideTreatment, setSideTreatment] = useState<CanvasSideTreatment>("image");
  const [solidSideColorHex, setSolidSideColorHex] = useState(CANVAS_SOLID_SIDE_DEFAULT_HEX);
  const [canvasSideColorPickActive, setCanvasSideColorPickActive] = useState(false);
  const showCanvasWrapMarginPreview =
    isCanvasPrintItem && canvasSideTreatmentShowsWrapMarginPreview(sideTreatment);

  const cropHostStyle = useMemo(() => {
    const base = cropSize
      ? {
          ...cropPreviewLetterboxStyle,
          width: cropSize.width,
          height: cropSize.height,
          maxWidth: "100%",
          maxHeight: "100%",
        }
      : { ...cropPreviewLetterboxStyle, width: "100%", minHeight: 280 };
    if (!showCanvasWrapMarginPreview) return base;
    return {
      ...base,
      ...canvasWrapBleedPreviewStyleVars(
        sideTreatment,
        solidSideColorHex,
        cropSize?.width,
        cropSize?.height,
      ),
    };
  }, [
    cropSize,
    cropPreviewLetterboxStyle,
    showCanvasWrapMarginPreview,
    sideTreatment,
    solidSideColorHex,
  ]);

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
      setSideTreatment("image");
      setSolidSideColorHex(CANVAS_SOLID_SIDE_DEFAULT_HEX);
      setCanvasSideColorPickActive(false);
      livePreviewUrlRef.current = null;
    }
  }, [open, imageUrl]);

  const composeCropSize = useMemo(() => {
    if (!mediaNatural || !cropSize) return undefined;
    return listingArtworkComposeCropSize({
      viewportCropSize: cropSize,
      naturalWidth: mediaNatural.width,
      naturalHeight: mediaNatural.height,
    });
  }, [cropSize, mediaNatural]);

  const cropperCropSize = composeCropSize ?? cropSize ?? undefined;

  const { cropFrame } = useListingArtworkCropFrameRect(containerRef, aspect, [
    open,
    crop,
    zoom,
    rotation,
    cropSize,
    composeCropSize,
    cropperCropSize,
    mediaNatural,
    imageUrl,
  ]);
  const showRoundedCornerGuide = useMemo(
    () =>
      listingArtworkCropShowsRoundedCornerGuide({
        showRoundedCornerCropGuide,
        catalogItemName,
        categoryTagSlug,
        printWidthPx,
        printHeightPx,
      }),
    [
      showRoundedCornerCropGuide,
      catalogItemName,
      categoryTagSlug,
      printWidthPx,
      printHeightPx,
    ],
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
          ...(mediaNatural
            ? {
                referenceSourceWidthPx: mediaNatural.width,
                referenceSourceHeightPx: mediaNatural.height,
              }
            : {}),
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
    mediaNatural,
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
    if (!mediaNatural) {
      setApplyError("Image is still loading. Wait a moment, then try again.");
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
        ...(mediaNatural
          ? {
              referenceSourceWidthPx: mediaNatural.width,
              referenceSourceHeightPx: mediaNatural.height,
            }
          : {}),
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
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
        <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <h3 id="listing-artwork-compose-title" className="text-sm font-semibold text-zinc-100">
            {surfaceLabel ? `Place artwork — ${surfaceLabel}` : "Place artwork on print canvas"}
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Print size {printWidthPx}×{printHeightPx}px — drag to move, zoom to scale.
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1fr_min(200px,35%)]">
            <div className="flex min-h-0 shrink-0 flex-col">
              <div ref={previewAreaRef} className={LISTING_ARTWORK_CROP_PREVIEW_BAND_CLASS}>
                <div
                  className="flex max-w-full shrink-0 flex-col"
                  style={cropSize ? { width: cropSize.width, maxWidth: "100%" } : undefined}
                >
                  <div
                    ref={containerRef}
                    className={`${LISTING_ARTWORK_CROP_PRINT_WINDOW_CLASS}${showCanvasWrapMarginPreview ? ` ${LISTING_ARTWORK_CROP_CANVAS_WRAP_PREVIEW_CLASS}` : ""} relative shrink-0 overflow-hidden`}
                    style={cropHostStyle}
                  >
              <Cropper
                key={imageUrl}
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                {...(cropperCropSize ? { cropSize: cropperCropSize } : {})}
                showGrid={!showCanvasWrapMarginPreview}
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
              <ListingArtworkCanvasGuideOverlay
                canvasPresentation={canvasPresentation}
                cropFrame={cropFrame}
              />
              {canvasSideColorPickActive && sideTreatment === "solid" ? (
                <ListingArtworkCanvasColorPickOverlay
                  containerRef={containerRef}
                  onPick={(hex) => {
                    setSolidSideColorHex(hex);
                    setCanvasSideColorPickActive(false);
                  }}
                  onCancel={() => setCanvasSideColorPickActive(false)}
                />
              ) : null}
              {showRoundedCornerGuide ? (
                <ListingArtworkRoundedCornerCropGuideOverlay
                  containerRef={containerRef}
                  fallbackSize={cropSize}
                />
              ) : null}
              {imageLoadError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 px-4 text-center text-xs text-amber-200/90">
                  {imageLoadError}
                </div>
              ) : null}
                  </div>
                  {isWraparound ? (
                    <ListingArtworkWraparoundPreviews
                      presentation={canvasPresentation}
                      cropFrame={cropFrame}
                      containerWidth={containerWidth}
                    />
                  ) : null}
                  {showBlackMugBackgroundTip ? (
                    <p className="mt-2 text-center text-xs leading-snug text-zinc-400">
                      If you print a black background on a black mug, it will be noticeable. Use a PNG
                      with a transparent background instead.
                    </p>
                  ) : showWhiteMugBackgroundTip ? (
                    <p className="mt-2 text-center text-xs leading-snug text-zinc-400">
                      White in your design is not printed on a white mug. A white background on your
                      image is OK.
                    </p>
                  ) : null}
                </div>
              </div>
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
        </div>
        <div className="shrink-0 space-y-2 border-t border-zinc-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-zinc-400">Rotate</span>
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
          {isCanvasPrintItem ? (
            <ListingCanvasSideTreatmentFields
              sideTreatment={sideTreatment}
              onSideTreatmentChange={(next) => {
                setSideTreatment(next);
                if (next !== "solid") setCanvasSideColorPickActive(false);
              }}
              solidSideColorHex={solidSideColorHex}
              onSolidSideColorHexChange={setSolidSideColorHex}
              colorPickActive={canvasSideColorPickActive}
              onColorPickActiveChange={setCanvasSideColorPickActive}
              disabled={busy}
            />
          ) : null}
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
