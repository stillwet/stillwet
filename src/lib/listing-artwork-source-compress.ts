import {
  LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES,
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
