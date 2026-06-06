import {
  listingArtworkCropExtractRegionForRotatedImage,
  listingArtworkRotateSize,
  type ListingArtworkCropArea,
} from "@/lib/listing-artwork-crop-math";
import {
  listingArtworkLetterboxFillUsesWhite,
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";

export type { ListingArtworkCropArea };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Image failed to load")));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = src;
  });
}

function downscaleSourceImage(
  image: HTMLImageElement,
  maxSourceLongEdge: number,
): { source: CanvasImageSource; width: number; height: number } {
  const origW = image.naturalWidth;
  const origH = image.naturalHeight;
  const scale = Math.min(1, maxSourceLongEdge / Math.max(origW, origH, 1));
  if (scale >= 1) {
    return { source: image, width: origW, height: origH };
  }

  const width = Math.max(1, Math.round(origW * scale));
  const height = Math.max(1, Math.round(origH * scale));
  const scaled = document.createElement("canvas");
  scaled.width = width;
  scaled.height = height;
  const ctx = scaled.getContext("2d", { alpha: true });
  if (!ctx) {
    return { source: image, width: origW, height: origH };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return { source: scaled, width, height };
}

/** Matches react-easy-crop `getCroppedImg` and server {@link buildRotatedImagePng}. */
function buildRotatedCanvasClient(
  source: CanvasImageSource,
  sourceWidthPx: number,
  sourceHeightPx: number,
  rotationDeg: number,
): { canvas: HTMLCanvasElement; width: number; height: number } | null {
  if (rotationDeg % 360 === 0) {
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidthPx;
    canvas.height = sourceHeightPx;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, sourceWidthPx, sourceHeightPx);
    ctx.drawImage(source, 0, 0, sourceWidthPx, sourceHeightPx);
    return { canvas, width: sourceWidthPx, height: sourceHeightPx };
  }

  const expected = listingArtworkRotateSize(sourceWidthPx, sourceHeightPx, rotationDeg);
  const width = Math.max(1, Math.round(expected.width));
  const height = Math.max(1, Math.round(expected.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  const rotRad = (rotationDeg * Math.PI) / 180;
  ctx.translate(width / 2, height / 2);
  ctx.rotate(rotRad);
  ctx.translate(-sourceWidthPx / 2, -sourceHeightPx / 2);
  ctx.drawImage(source, 0, 0, sourceWidthPx, sourceHeightPx);
  return { canvas, width, height };
}

/**
 * Preview/export crop using the same placement math as server bake.
 * `pixelCrop` stays in full-resolution cropper space; optional downscale is preview-only.
 */
export async function renderListingArtworkCropCanvas(
  imageSrc: string,
  pixelCrop: ListingArtworkCropArea,
  outW: number,
  outH: number,
  rotationDeg: number,
  options?: { maxSourceLongEdge?: number; letterboxFill?: ListingArtworkLetterboxFill | null },
): Promise<HTMLCanvasElement | null> {
  const image = await loadImage(imageSrc);
  const fullW = image.naturalWidth;
  const fullH = image.naturalHeight;

  const prepared =
    options?.maxSourceLongEdge != null && options.maxSourceLongEdge > 0
      ? downscaleSourceImage(image, options.maxSourceLongEdge)
      : { source: image as CanvasImageSource, width: fullW, height: fullH };

  const rotated = buildRotatedCanvasClient(prepared.source, prepared.width, prepared.height, rotationDeg);
  if (!rotated) return null;

  const region = listingArtworkCropExtractRegionForRotatedImage({
    pixelCrop,
    sourceWidthPx: fullW,
    sourceHeightPx: fullH,
    rotationDeg,
    rotatedWidthPx: rotated.width,
    rotatedHeightPx: rotated.height,
    printWidthPx: outW,
    printHeightPx: outH,
  });
  if (!region) return null;

  const cropped = document.createElement("canvas");
  cropped.width = region.width;
  cropped.height = region.height;
  const cctx = cropped.getContext("2d", { alpha: true });
  if (!cctx) return null;
  cctx.clearRect(0, 0, region.width, region.height);
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(rotated.canvas, -region.x, -region.y);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const useWhiteLetterbox = listingArtworkLetterboxFillUsesWhite(options?.letterboxFill);
  const octx = out.getContext("2d", { alpha: !useWhiteLetterbox });
  if (!octx) return null;
  if (useWhiteLetterbox) {
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, out.width, out.height);
  } else {
    octx.clearRect(0, 0, out.width, out.height);
  }
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cropped, 0, 0, region.width, region.height, 0, 0, outW, outH);

  return out;
}

export function listingArtworkCropPreviewDimensions(
  printWidthPx: number,
  printHeightPx: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const aspect = printWidthPx / printHeightPx;
  if (aspect >= 1) {
    return {
      width: maxLongEdge,
      height: Math.max(1, Math.round(maxLongEdge / aspect)),
    };
  }
  return {
    width: Math.max(1, Math.round(maxLongEdge * aspect)),
    height: maxLongEdge,
  };
}
