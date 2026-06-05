import {
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

function downscaleSourceForCrop(
  image: HTMLImageElement,
  pixelCrop: ListingArtworkCropArea,
  maxSourceLongEdge: number,
): {
  source: CanvasImageSource;
  width: number;
  height: number;
  pixelCrop: ListingArtworkCropArea;
} {
  const origW = image.naturalWidth;
  const origH = image.naturalHeight;
  const scale = Math.min(1, maxSourceLongEdge / Math.max(origW, origH, 1));
  if (scale >= 1) {
    return { source: image, width: origW, height: origH, pixelCrop };
  }

  const width = Math.max(1, Math.round(origW * scale));
  const height = Math.max(1, Math.round(origH * scale));
  const scaleX = width / origW;
  const scaleY = height / origH;

  const scaled = document.createElement("canvas");
  scaled.width = width;
  scaled.height = height;
  const ctx = scaled.getContext("2d", { alpha: true });
  if (!ctx) {
    return { source: image, width: origW, height: origH, pixelCrop };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  return {
    source: scaled,
    width,
    height,
    pixelCrop: {
      x: pixelCrop.x * scaleX,
      y: pixelCrop.y * scaleY,
      width: pixelCrop.width * scaleX,
      height: pixelCrop.height * scaleY,
    },
  };
}

/**
 * `pixelCrop` from react-easy-crop is in the rotated image bounding-box space.
 * Matches the crop dialog export path; optional `maxSourceLongEdge` downscales for previews only.
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
  const prepared =
    options?.maxSourceLongEdge != null && options.maxSourceLongEdge > 0
      ? downscaleSourceForCrop(image, pixelCrop, options.maxSourceLongEdge)
      : {
          source: image as CanvasImageSource,
          width: image.naturalWidth,
          height: image.naturalHeight,
          pixelCrop,
        };

  const { source, width: nw, height: nh, pixelCrop: crop } = prepared;
  const rad = (rotationDeg * Math.PI) / 180;
  const { width: bboxW, height: bboxH } = listingArtworkRotateSize(nw, nh, rotationDeg);

  const rotated = document.createElement("canvas");
  rotated.width = Math.round(bboxW);
  rotated.height = Math.round(bboxH);
  const rctx = rotated.getContext("2d", { alpha: true });
  if (!rctx) return null;
  rctx.clearRect(0, 0, rotated.width, rotated.height);
  rctx.imageSmoothingEnabled = true;
  rctx.imageSmoothingQuality = "high";
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate(rad);
  rctx.drawImage(source, -nw / 2, -nh / 2, nw, nh);

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
  octx.drawImage(
    rotated,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outW,
    outH,
  );

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
