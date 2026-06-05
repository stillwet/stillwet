"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import type { ListingArtworkCropCompleteResult } from "@/lib/listing-artwork-crop-payload";
import { renderListingArtworkCropCanvas } from "@/lib/listing-artwork-crop-canvas-client";
import {
  cropRegionMeetsPrintMinimum,
  effectiveArtworkDpiFromCropAndPrint,
  minSourceCropPixelsForPrintDpi,
  PRINT_AREA_REFERENCE_DPI,
} from "@/lib/listing-artwork-print-area";
import { compressListingArtworkCanvasToFile } from "@/lib/listing-artwork-source-compress";
import { listingArtworkUseServerSideCrop } from "@/lib/listing-artwork-browser-crop-threshold";
import {
  listingArtworkFileWithinUploadCap,
  listingArtworkUploadCapError,
  listingRequestArtworkStoredMaxMb,
} from "@/lib/listing-request-artwork-limits";

/** Dark checkerboard so transparent / letterboxed areas read as “empty”, not solid white. */
export const ARTWORK_TRANSPARENCY_PREVIEW_STYLE: CSSProperties = {
  backgroundColor: "#09090b",
  backgroundImage:
    "linear-gradient(45deg, rgb(39 39 42 / 0.95) 25%, transparent 25%), linear-gradient(-45deg, rgb(39 39 42 / 0.95) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(39 39 42 / 0.95) 75%), linear-gradient(-45deg, transparent 75%, rgb(39 39 42 / 0.95) 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
};

/** Lets the artwork sit smaller than the crop frame (letterbox); export keeps transparency (PNG). */
const CROP_MIN_ZOOM = 0.2;
const CROP_MAX_ZOOM = 4;

export function ListingArtworkCropDialog({
  open,
  imageUrl,
  sourceFile,
  printWidthPx,
  printHeightPx,
  minArtworkDpi,
  onClose,
  onComplete,
}: {
  open: boolean;
  imageUrl: string;
  sourceFile: File;
  printWidthPx: number;
  printHeightPx: number;
  /** When set with print area, requires more source pixels vs. 300 DPI template. */
  minArtworkDpi: number | null;
  onClose: () => void;
  onComplete: (result: ListingArtworkCropCompleteResult) => void;
}) {
  const aspect = printWidthPx / printHeightPx;
  const useServerCrop = listingArtworkUseServerSideCrop(printWidthPx, printHeightPx, sourceFile.size);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRotation(0);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedAreaPixels(null);
      setApplyError(null);
    }
  }, [open, imageUrl]);

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

  const effectiveDpiBelowMin =
    effectiveDpi != null &&
    minArtworkDpi != null &&
    minArtworkDpi > 0 &&
    effectiveDpi + 0.01 < minArtworkDpi;

  async function apply() {
    setApplyError(null);
    if (!croppedAreaPixels) {
      setApplyError("Adjust the crop, then try again.");
      return;
    }
    const { minW, minH } = minSourceCropPixelsForPrintDpi(printWidthPx, printHeightPx, minArtworkDpi);
    if (!cropRegionMeetsPrintMinimum(croppedAreaPixels.width, croppedAreaPixels.height, minW, minH)) {
      setApplyError(
        minArtworkDpi != null && minArtworkDpi > 0
          ? `Zoom out so the crop covers at least ${minW}×${minH}px of your image (${minArtworkDpi} DPI vs. 300 DPI template — no upscaling).`
          : `Zoom out so the crop covers at least ${printWidthPx}×${printHeightPx}px of your image (no upscaling).`,
      );
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
      );
      if (!canvas) {
        setApplyError("Could not build the cropped image. Try another file.");
        return;
      }
      const compressed = await compressListingArtworkCanvasToFile(canvas, "listing-artwork", false);
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
      ? "Upload + Crop"
      : "Use cropped artwork";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-artwork-crop-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 id="listing-artwork-crop-title" className="text-sm font-semibold text-zinc-100">
            Crop artwork to print area
          </h3>
        </div>
        <div className="relative h-[min(52vh,400px)] w-full" style={ARTWORK_TRANSPARENCY_PREVIEW_STYLE}>
          <Cropper
            key={imageUrl}
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={(z) =>
              setZoom(Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, z)))
            }
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            restrictPosition={false}
            minZoom={CROP_MIN_ZOOM}
            maxZoom={CROP_MAX_ZOOM}
            style={{ containerStyle: ARTWORK_TRANSPARENCY_PREVIEW_STYLE }}
          />
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
                  {minArtworkDpi != null && minArtworkDpi > 0 ? (
                    <span className={effectiveDpiBelowMin ? "text-amber-200/80" : "text-zinc-600"}>
                      {" "}
                      (min {minArtworkDpi})
                    </span>
                  ) : null}
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
