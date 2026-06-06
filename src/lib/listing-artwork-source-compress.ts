import type { ListingArtworkCropPixelArea } from "@/lib/listing-artwork-crop-payload";
import { minSourceCropPixelsForPrintDpi } from "@/lib/listing-artwork-print-area";
import {
  LISTING_ARTWORK_BROWSER_CROP_SOURCE_MAX_BYTES,
  LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES,
  LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES,
  listingRequestArtworkStoredMaxMb,
} from "@/lib/listing-request-artwork-limits";

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function mimeSupported(type: string): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const data = canvas.toDataURL(type);
  return data.startsWith(`data:${type}`);
}

function extForMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return "jpeg";
}

function baseNameFromFile(file: File): string {
  const stem = file.name.replace(/\.[^.]+$/, "").trim() || "artwork";
  return stem.slice(0, 80);
}

async function encodeCanvasUnderCap(
  source: HTMLCanvasElement,
  maxBytes: number,
  preferAlpha: boolean,
): Promise<Blob | null> {
  const mimeOrder = preferAlpha
    ? ["image/webp", "image/png", "image/jpeg"]
    : ["image/jpeg", "image/webp"];

  for (const mime of mimeOrder) {
    if (!mimeSupported(mime)) continue;
    for (let q = 0.92; q >= 0.52; q -= 0.06) {
      const blob = await canvasToBlob(source, mime, q);
      if (blob && blob.size > 0 && blob.size <= maxBytes) return blob;
    }
    const blobMin = await canvasToBlob(source, mime, 0.5);
    if (blobMin && blobMin.size > 0 && blobMin.size <= maxBytes) return blobMin;
  }
  return null;
}

async function renderFileToCanvas(file: File, scale: number): Promise<HTMLCanvasElement | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas;
}

function artworkUnderUploadCapError(): string {
  return `Could not fit artwork under the ${LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES / (1024 * 1024)} MB upload limit. Try zooming in on the crop or using a smaller source file.`;
}

function artworkUnderStoredCapError(): string {
  const capMb = listingRequestArtworkStoredMaxMb();
  return `Could not fit artwork under ${capMb} MB at print size. Try a simpler design, zoom in on the crop, or use a smaller source file.`;
}

/**
 * After crop (fixed print pixel size): re-encode without resizing when possible.
 */
export async function compressListingArtworkCanvasToFile(
  canvas: HTMLCanvasElement,
  filenameStem: string,
  preferAlpha = true,
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  const cap = LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES;
  const blob = await encodeCanvasUnderCap(canvas, cap, preferAlpha);
  if (!blob) {
    return { ok: false, error: artworkUnderStoredCapError() };
  }
  const ext = extForMime(blob.type);
  const out = new File([blob], `${filenameStem}.${ext}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
  return { ok: true, file: out };
}

/** Large sources are re-encoded before staging upload to reduce server decode RAM. */
export const LISTING_ARTWORK_STAGING_SOURCE_RECOMPRESS_MIN_BYTES = LISTING_ARTWORK_BROWSER_CROP_SOURCE_MAX_BYTES;

/** Megapixels above which staging upload recompresses even under the byte cap. */
export const LISTING_ARTWORK_STAGING_SOURCE_RECOMPRESS_MIN_PIXELS = 12_000_000;

/**
 * Server-crop path: shrink huge photos before chunked staging while preserving crop DPI minimums.
 */
export async function compressListingArtworkSourceForStagingUpload(
  file: File,
  opts: {
    crop: ListingArtworkCropPixelArea;
    printWidthPx: number;
    printHeightPx: number;
    minArtworkDpi: number | null;
  },
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  let sourceW = 0;
  let sourceH = 0;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    sourceW = bitmap.width;
    sourceH = bitmap.height;
    bitmap.close();
  } catch {
    return {
      ok: false,
      error: "Could not read that image in the browser. Try PNG or JPEG.",
    };
  }

  const megapixels = sourceW * sourceH;
  const shouldRecompress =
    file.size > LISTING_ARTWORK_STAGING_SOURCE_RECOMPRESS_MIN_BYTES ||
    megapixels > LISTING_ARTWORK_STAGING_SOURCE_RECOMPRESS_MIN_PIXELS;

  if (!shouldRecompress) {
    return { ok: true, file };
  }

  const { minW, minH } = minSourceCropPixelsForPrintDpi(
    opts.printWidthPx,
    opts.printHeightPx,
    opts.minArtworkDpi,
  );
  const minScaleFromCrop = Math.max(
    minW / Math.max(1, opts.crop.width),
    minH / Math.max(1, opts.crop.height),
    0.01,
  );

  const preferAlpha = file.type === "image/png" || file.type === "image/webp";
  const uploadCap = LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;

  let scale = Math.min(1, minScaleFromCrop * 0.999);
  for (let attempt = 0; attempt < 14; attempt++) {
    const canvas = await renderFileToCanvas(file, scale);
    if (!canvas) {
      return {
        ok: false,
        error: "Could not read that image in the browser. Try PNG or JPEG.",
      };
    }

    const blob = await encodeCanvasUnderCap(canvas, uploadCap, preferAlpha);
    if (blob) {
      const ext = extForMime(blob.type);
      const out = new File([blob], `${baseNameFromFile(file)}-staging.${ext}`, {
        type: blob.type,
        lastModified: Date.now(),
      });
      return { ok: true, file: out };
    }

    scale *= 0.9;
    if (scale < minScaleFromCrop) break;
    if (canvas.width < minW || canvas.height < minH) break;
  }

  return { ok: false, error: artworkUnderUploadCapError() };
}

/**
 * Non-crop path: re-encode when over the stored cap (quality, then slight downscale).
 */
export async function compressListingArtworkFileIfNeeded(
  file: File,
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  if (file.size <= LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES) {
    return { ok: true, file };
  }

  const preferAlpha = file.type === "image/png" || file.type === "image/webp";
  const cap = LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES;

  let scale = 1;
  for (let attempt = 0; attempt < 12; attempt++) {
    const canvas = await renderFileToCanvas(file, scale);
    if (!canvas) {
      return {
        ok: false,
        error: "Could not read that image in the browser. Try PNG or JPEG.",
      };
    }

    const blob = await encodeCanvasUnderCap(canvas, cap, preferAlpha);
    if (blob) {
      const ext = extForMime(blob.type);
      const out = new File([blob], `${baseNameFromFile(file)}-prepared.${ext}`, {
        type: blob.type,
        lastModified: Date.now(),
      });
      return { ok: true, file: out };
    }

    scale *= 0.92;
    if (canvas.width < 800 || canvas.height < 800) break;
  }

  return { ok: false, error: artworkUnderStoredCapError() };
}

/** @deprecated Use {@link compressListingArtworkFileIfNeeded}. */
export const compressListingArtworkSourceIfNeeded = compressListingArtworkFileIfNeeded;

/**
 * Strip EXIF orientation into pixel data so cropper coords match server bake.
 * Run before opening the crop dialog (v1 path).
 */
export async function normalizeListingArtworkSourceFileForCrop(
  file: File,
): Promise<{ ok: true; file: File; width: number; height: number } | { ok: false; error: string }> {
  if (file.type === "image/svg+xml") {
    return { ok: false, error: "SVG is not supported. Use PNG or JPEG." };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return {
      ok: false,
      error: "Could not read that image in the browser. Try PNG or JPEG.",
    };
  }

  const width = bitmap.width;
  const height = bitmap.height;
  if (!(width > 0) || !(height > 0)) {
    bitmap.close();
    return {
      ok: false,
      error: "Could not read that image in the browser. Try PNG or JPEG.",
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    bitmap.close();
    return {
      ok: false,
      error: "Could not read that image in the browser. Try PNG or JPEG.",
    };
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const preferAlpha = file.type === "image/png" || file.type === "image/webp";
  const mimeOrder = preferAlpha
    ? ["image/webp", "image/png", "image/jpeg"]
    : ["image/jpeg", "image/webp"];

  let blob: Blob | null = null;
  let mime = "image/jpeg";
  for (const candidate of mimeOrder) {
    if (!mimeSupported(candidate)) continue;
    const attempt = await canvasToBlob(canvas, candidate, candidate === "image/jpeg" ? 0.92 : undefined);
    if (attempt && attempt.size > 0) {
      blob = attempt;
      mime = candidate;
      break;
    }
  }
  if (!blob) {
    return {
      ok: false,
      error: "Could not prepare that image for cropping. Try PNG or JPEG.",
    };
  }

  const ext = extForMime(mime);
  const stem = baseNameFromFile(file);
  const out = new File([blob], `${stem}-oriented.${ext}`, {
    type: mime,
    lastModified: Date.now(),
  });
  return { ok: true, file: out, width, height };
}
