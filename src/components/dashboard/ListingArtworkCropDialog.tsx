"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import type { ListingArtworkCropCompleteResult } from "@/lib/listing-artwork-crop-payload";
import { renderListingArtworkCropCanvas } from "@/lib/listing-artwork-crop-canvas-client";
import {
  listingArtworkLetterboxFillUsesWhite,
  listingArtworkLetterboxPreviewStyle,
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import {
  effectiveArtworkDpiFromCropAndPrint,
  listingArtworkEffectiveDpiBlockError,
  listingArtworkEffectiveDpiBelowRequired,
  listingArtworkEffectiveDpiUpscaleWarning,
  listingArtworkRequiredEffectiveDpi,
  PRINT_AREA_REFERENCE_DPI,
} from "@/lib/listing-artwork-print-area";
import { compressListingArtworkCanvasToFile } from "@/lib/listing-artwork-source-compress";
import { listingArtworkUseServerSideCrop } from "@/lib/listing-artwork-browser-crop-threshold";
import { useListingArtworkCropViewportSize } from "@/hooks/useListingArtworkCropViewportSize";
import {
  listingArtworkComposeCropSize,
  LISTING_ARTWORK_CROP_PREVIEW_BAND_CLASS,
  LISTING_ARTWORK_CROP_CANVAS_WRAP_PREVIEW_CLASS,
  LISTING_ARTWORK_CROP_PRINT_WINDOW_CLASS,
} from "@/lib/listing-artwork-crop-viewport";
import type { CatalogCanvasPresentation } from "@/lib/admin-catalog-canvas-presentation";
import { CATALOG_CANVAS_PRESENTATION_FLAT } from "@/lib/admin-catalog-canvas-presentation";
import { ListingArtworkCanvasGuideOverlay } from "@/components/dashboard/ListingArtworkCanvasGuideOverlay";
import { ListingArtworkRoundedCornerCropGuideOverlay } from "@/components/dashboard/ListingArtworkRoundedCornerCropGuideOverlay";
import { ListingArtworkCanvasColorPickOverlay } from "@/components/dashboard/ListingArtworkCanvasColorPickOverlay";
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
import {
  listingArtworkFileWithinUploadCap,
  listingArtworkUploadCapError,
  listingRequestArtworkStoredMaxMb,
} from "@/lib/listing-request-artwork-limits";

/** @deprecated Use {@link ARTWORK_TRANSPARENT_LETTERBOX_PREVIEW_STYLE} from listing-artwork-letterbox-fill. */
export { ARTWORK_TRANSPARENT_LETTERBOX_PREVIEW_STYLE as ARTWORK_TRANSPARENCY_PREVIEW_STYLE } from "@/lib/listing-artwork-letterbox-fill";

/** Lets the artwork sit smaller than the crop frame (letterbox); margin fill depends on catalog item. */
const CROP_MIN_ZOOM = 0.2;
const CROP_MAX_ZOOM = 4;

export function ListingArtworkCropDialog({
  open,
  imageUrl,
  sourceFile,
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
  sourceFile: File;
  printWidthPx: number;
  printHeightPx: number;
  /** When set, blocks crop apply when effective DPI is below this (server upscales to print size). */
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
  onComplete: (result: ListingArtworkCropCompleteResult) => void;
}) {
  const aspect = printWidthPx / printHeightPx;
  const isWraparound = canvasPresentation.type === "wraparound";
  const useServerCrop = listingArtworkUseServerSideCrop(printWidthPx, printHeightPx, sourceFile.size);
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
  const preferAlphaExport = !listingArtworkLetterboxFillUsesWhite(artworkLetterboxFill);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  useEffect(() => {
    if (open) {
      setRotation(0);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
      setApplyError(null);
      setMediaNatural(null);
      setSideTreatment("image");
      setSolidSideColorHex(CANVAS_SOLID_SIDE_DEFAULT_HEX);
      setCanvasSideColorPickActive(false);
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

  async function apply() {
    setApplyError(null);
    if (!croppedAreaPixels) {
      setApplyError("Adjust the crop, then try again.");
      return;
    }
    if (!(croppedAreaPixels.width > 0) || !(croppedAreaPixels.height > 0)) {
      setApplyError("Adjust the crop, then try again.");
      return;
    }
    if (effectiveDpi == null) {
      setApplyError("Could not read crop size. Adjust the crop and try again.");
      return;
    }
    if (requiredEffectiveDpi != null && effectiveDpi + 0.01 < requiredEffectiveDpi) {
      setApplyError(listingArtworkEffectiveDpiBlockError(effectiveDpi, requiredEffectiveDpi));
      return;
    }
    if (useServerCrop && !mediaNatural) {
      setApplyError("Image is still loading. Wait a moment, then try again.");
      return;
    }
    if (!listingArtworkFileWithinUploadCap(sourceFile.size)) {
      setApplyError(listingArtworkUploadCapError());
      return;
    }

    setBusy(true);
    try {
      if (useServerCrop) {
        onComplete({
          mode: "serverCrop",
          crop: {
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
          },
          sourceFile,
        });
        return;
      }

      const canvas = await renderListingArtworkCropCanvas(
        imageUrl,
        croppedAreaPixels,
        printWidthPx,
        printHeightPx,
        rotation,
        { letterboxFill: artworkLetterboxFill },
      );
      if (!canvas) {
        setApplyError("Could not build the cropped image. Try another file.");
        return;
      }
      const compressed = await compressListingArtworkCanvasToFile(
        canvas,
        "listing-artwork",
        preferAlphaExport,
      );
      if (!compressed.ok) {
        setApplyError(compressed.error);
        return;
      }
      onComplete({ mode: "file", file: compressed.file });
    } catch {
      setApplyError("Could not build the cropped image. Try another file.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const applyLabel = busy
    ? useServerCrop
      ? "Saving crop…"
      : `Compressing to ${listingRequestArtworkStoredMaxMb()} MB…`
    : useServerCrop
      ? "Upload"
      : "Use cropped artwork";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-artwork-crop-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
        <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <h3 id="listing-artwork-crop-title" className="text-sm font-semibold text-zinc-100">
            {surfaceLabel ? `Crop artwork — ${surfaceLabel}` : "Crop artwork to print area"}
          </h3>
        </div>
        <div className="shrink-0 overflow-hidden">
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
              setZoom(Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, z)))
            }
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onMediaLoaded={(mediaSize) => {
              void (async () => {
                try {
                  const bitmap = await createImageBitmap(sourceFile, {
                    imageOrientation: "from-image",
                  });
                  setMediaNatural({ width: bitmap.width, height: bitmap.height });
                  bitmap.close();
                } catch {
                  setMediaNatural({
                    width: mediaSize.naturalWidth,
                    height: mediaSize.naturalHeight,
                  });
                }
              })();
            }}
            restrictPosition={false}
            minZoom={CROP_MIN_ZOOM}
            maxZoom={CROP_MAX_ZOOM}
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
              aria-label="Rotate image 90 degrees counter-clockwise"
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
              aria-label="Rotate image 90 degrees clockwise"
            >
              ⟳ 90°
            </button>
            {rotation !== 0 ? (
              <span className="text-xs tabular-nums text-zinc-600">{rotation}°</span>
            ) : null}
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
              min={CROP_MIN_ZOOM}
              max={CROP_MAX_ZOOM}
              step={0.02}
              value={zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                setZoom(Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, z)));
              }}
              className="min-w-0 flex-1"
            />
          </label>
          {upscaleSoftWarning && effectiveDpi != null ? (
            <p className="text-xs text-zinc-500" role="status">
              <span className="font-semibold text-zinc-100">
                Below {PRINT_AREA_REFERENCE_DPI} DPI
              </span>
              {" "}
              — Not recommended, but acceptable.
              <br />
              Print may look soft; zoom out or use a higher-resolution file for sharper results.
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
              title={`Relative to a ${PRINT_AREA_REFERENCE_DPI} DPI print template (${printWidthPx}×${printHeightPx}px).`}
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
                {applyLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
