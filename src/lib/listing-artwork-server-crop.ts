import sharp from "sharp";
import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import {
  cropCompositePlacementOnPrint,
  listingArtworkCropExtractRegionForRotatedImage,
  visibleCompositeSlice,
} from "@/lib/listing-artwork-crop-math";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";
import {
  listingArtworkLetterboxFillUsesWhite,
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";
import { LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS } from "@/lib/listing-request-artwork-limits";

sharp.cache(false);
sharp.concurrency(1);

export type ListingArtworkPrintBuildOptions = {
  letterboxFill?: ListingArtworkLetterboxFill | null;
  maxDecodePixels?: number;
};

export type ListingArtworkEncodedPrint = {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  fileExtension: "jpeg" | "png" | "webp";
  width: number;
  height: number;
};

const SHARP_INPUT = { failOn: "none" as const, limitInputPixels: false };
/** Direct crop canvas above this size uses scaled placement instead (extreme zoom-out). */
const CROP_REGION_DIRECT_MAX_PIXELS = 25_000_000;

function transparentBackground(): { r: number; g: number; b: number; alpha: number } {
  return { r: 0, g: 0, b: 0, alpha: 0 };
}

function whiteBackground(): { r: number; g: number; b: number; alpha: number } {
  return { r: 255, g: 255, b: 255, alpha: 1 };
}

function printBackground(letterboxFill: ListingArtworkLetterboxFill | null | undefined) {
  return listingArtworkLetterboxFillUsesWhite(letterboxFill) ? whiteBackground() : transparentBackground();
}

async function getOrientedMetadata(input: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(input, SHARP_INPUT).rotate().metadata();
    if (!meta.width || !meta.height) return null;
    return { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/**
 * Rotated bbox image as PNG — matches react-easy-crop `getCroppedImg` and browser canvas export.
 */
async function buildRotatedImagePng(
  input: Buffer,
  sourceWidthPx: number,
  sourceHeightPx: number,
  rotation: number,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  if (rotation % 360 === 0) {
    const buffer = await sharp(input, SHARP_INPUT).rotate().toBuffer();
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) return null;
    return { buffer, width: meta.width, height: meta.height };
  }

  const oriented = await sharp(input, SHARP_INPUT).rotate().toBuffer();
  const rotated = await sharp(oriented)
    .rotate(rotation, { background: transparentBackground() })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: rotated.data,
    width: rotated.info.width,
    height: rotated.info.height,
  };
}

/** Extract crop region (supports letterbox via negative x/y) then resize to print pixels. */
async function buildExtractedCropPng(
  rotatedPng: Buffer,
  rotatedWidthPx: number,
  rotatedHeightPx: number,
  crop: { x: number; y: number; width: number; height: number },
): Promise<Buffer | null> {
  const cropW = Math.max(1, Math.round(crop.width));
  const cropH = Math.max(1, Math.round(crop.height));
  const cropX = Math.round(crop.x);
  const cropY = Math.round(crop.y);

  try {
    if (cropX >= 0 && cropY >= 0 && cropX + cropW <= rotatedWidthPx && cropY + cropH <= rotatedHeightPx) {
      return await sharp(rotatedPng)
        .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
        .png()
        .toBuffer();
    }

    const srcLeft = Math.max(0, cropX);
    const srcTop = Math.max(0, cropY);
    const srcRight = Math.min(rotatedWidthPx, cropX + cropW);
    const srcBottom = Math.min(rotatedHeightPx, cropY + cropH);
    const visibleW = srcRight - srcLeft;
    const visibleH = srcBottom - srcTop;

    let pipeline = sharp({
      create: {
        width: cropW,
        height: cropH,
        channels: 4,
        background: transparentBackground(),
      },
    });

    if (visibleW > 0 && visibleH > 0) {
      const slice = await sharp(rotatedPng)
        .extract({ left: srcLeft, top: srcTop, width: visibleW, height: visibleH })
        .png()
        .toBuffer();
      pipeline = pipeline.composite([
        {
          input: slice,
          left: srcLeft - cropX,
          top: srcTop - cropY,
        },
      ]);
    }

    return await pipeline.png().toBuffer();
  } catch {
    return null;
  }
}

/** Scaled + clipped artwork layer for extreme zoom-out (avoids huge crop canvases). */
async function buildOverlayPngFromPlacement(
  rotatedPng: Buffer,
  rotatedWidthPx: number,
  rotatedHeightPx: number,
  region: { x: number; y: number; width: number; height: number },
  printWidthPx: number,
  printHeightPx: number,
): Promise<{ png: Buffer; destLeft: number; destTop: number } | null> {
  const placement = cropCompositePlacementOnPrint(
    rotatedWidthPx,
    rotatedHeightPx,
    region,
    printWidthPx,
    printHeightPx,
  );
  const slice = visibleCompositeSlice({
    left: placement.left,
    top: placement.top,
    width: placement.scaledWidthPx,
    height: placement.scaledHeightPx,
    canvasWidth: printWidthPx,
    canvasHeight: printHeightPx,
  });
  if (!slice) return null;

  try {
    let pipeline = sharp(rotatedPng).resize(placement.scaledWidthPx, placement.scaledHeightPx, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    });

    if (slice.width !== placement.scaledWidthPx || slice.height !== placement.scaledHeightPx) {
      pipeline = pipeline.extract({
        left: slice.srcLeft,
        top: slice.srcTop,
        width: slice.width,
        height: slice.height,
      });
    }

    const png = await pipeline.png().toBuffer();
    return { png, destLeft: slice.destLeft, destTop: slice.destTop };
  } catch {
    return null;
  }
}

async function buildPrintPngFromCrop(
  rotated: { buffer: Buffer; width: number; height: number },
  region: { x: number; y: number; width: number; height: number },
  printWidthPx: number,
  printHeightPx: number,
  useWhite: boolean,
): Promise<Buffer | null> {
  if (region.width * region.height <= CROP_REGION_DIRECT_MAX_PIXELS) {
    const cropPng = await buildExtractedCropPng(rotated.buffer, rotated.width, rotated.height, region);
    if (!cropPng) return null;
    return sharp(cropPng)
      .resize(printWidthPx, printHeightPx, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();
  }

  const overlay = await buildOverlayPngFromPlacement(
    rotated.buffer,
    rotated.width,
    rotated.height,
    region,
    printWidthPx,
    printHeightPx,
  );
  if (!overlay) return null;

  const background = useWhite ? whiteBackground() : transparentBackground();
  return sharp({
    create: {
      width: printWidthPx,
      height: printHeightPx,
      channels: 4,
      background,
    },
  })
    .composite([{ input: overlay.png, left: overlay.destLeft, top: overlay.destTop }])
    .png()
    .toBuffer();
}

async function encodeWhitePrintJpegFromPng(
  printPng: Buffer,
  printWidthPx: number,
  printHeightPx: number,
  storedMaxBytes: number,
): Promise<ListingArtworkEncodedPrint | null> {
  let low = 52;
  let high = 92;
  let best: Buffer | null = null;

  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    const body = await sharp(printPng)
      .flatten({ background: whiteBackground() })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (body.length <= storedMaxBytes) {
      best = body;
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }

  if (!best) {
    const body = await sharp(printPng)
      .flatten({ background: whiteBackground() })
      .jpeg({ quality: 52, mozjpeg: true })
      .toBuffer();
    if (body.length > storedMaxBytes) return null;
    best = body;
  }

  return {
    body: best,
    contentType: "image/jpeg",
    fileExtension: "jpeg",
    width: printWidthPx,
    height: printHeightPx,
  };
}

async function encodeTransparentPrintFromPng(
  printPng: Buffer,
  printWidthPx: number,
  printHeightPx: number,
  storedMaxBytes: number,
): Promise<ListingArtworkEncodedPrint | null> {
  const base = () => sharp(printPng).ensureAlpha();

  const pngBody = await base().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  if (pngBody.length <= storedMaxBytes) {
    return {
      body: pngBody,
      contentType: "image/png",
      fileExtension: "png",
      width: printWidthPx,
      height: printHeightPx,
    };
  }

  for (let q = 92; q >= 58; q -= 6) {
    const body = await base().webp({ quality: q, effort: 4, alphaQuality: q }).toBuffer();
    if (body.length <= storedMaxBytes) {
      return {
        body,
        contentType: "image/webp",
        fileExtension: "webp",
        width: printWidthPx,
        height: printHeightPx,
      };
    }
  }

  for (let q = 90; q >= 62; q -= 7) {
    const body = await base()
      .flatten({ background: whiteBackground() })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
    if (body.length <= storedMaxBytes) {
      return {
        body,
        contentType: "image/jpeg",
        fileExtension: "jpeg",
        width: printWidthPx,
        height: printHeightPx,
      };
    }
  }

  return null;
}

/**
 * Crop + composite + encode in one pass without materializing a full print-sized RGBA buffer.
 */
export async function cropAndEncodeListingArtwork(
  input: Buffer,
  crop: ListingArtworkCropPayload,
  storedMaxBytes: number,
  options?: ListingArtworkPrintBuildOptions,
): Promise<ListingArtworkEncodedPrint | null> {
  const { pixelCrop, rotation, printWidthPx, printHeightPx } = crop;
  const useWhite = listingArtworkLetterboxFillUsesWhite(options?.letterboxFill);

  try {
    const orientedMeta = await getOrientedMetadata(input);
    if (!orientedMeta) return null;

    const sourceWidthPx = orientedMeta.width;
    const sourceHeightPx = orientedMeta.height;
    const maxDecodePixels = options?.maxDecodePixels ?? LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS;
    if (sourceWidthPx * sourceHeightPx > maxDecodePixels) return null;

    const rotated = await buildRotatedImagePng(input, sourceWidthPx, sourceHeightPx, rotation);
    if (!rotated) return null;

    const region = listingArtworkCropExtractRegionForRotatedImage({
      pixelCrop,
      sourceWidthPx,
      sourceHeightPx,
      rotationDeg: rotation,
      rotatedWidthPx: rotated.width,
      rotatedHeightPx: rotated.height,
      printWidthPx,
      printHeightPx,
    });
    if (!region) return null;

    const printPng = await buildPrintPngFromCrop(rotated, region, printWidthPx, printHeightPx, useWhite);
    if (!printPng) return null;

    const encoded = useWhite
      ? await encodeWhitePrintJpegFromPng(printPng, printWidthPx, printHeightPx, storedMaxBytes)
      : await encodeTransparentPrintFromPng(printPng, printWidthPx, printHeightPx, storedMaxBytes);

    if (
      !encoded ||
      !exportedImageMeetsPrintDimensions(encoded.width, encoded.height, printWidthPx, printHeightPx)
    ) {
      return null;
    }

    return encoded;
  } catch (e) {
    console.error("[listing-artwork-server-crop]", e);
    return null;
  }
}

/**
 * Crop + composite onto a print-sized RGBA buffer (tests / legacy). Prefer {@link cropAndEncodeListingArtwork}.
 */
export async function buildListingArtworkPrintRgba(
  input: Buffer,
  crop: ListingArtworkCropPayload,
  options?: ListingArtworkPrintBuildOptions,
): Promise<{ data: Buffer; width: number; height: number } | null> {
  const encoded = await cropAndEncodeListingArtwork(input, crop, Number.MAX_SAFE_INTEGER, options);
  if (!encoded) return null;

  try {
    const { data, info } = await sharp(encoded.body).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/**
 * Crop + resize on the server (sharp). Matches browser crop dialog / canvas export.
 */
export async function cropListingArtworkBufferOnServer(
  input: Buffer,
  crop: ListingArtworkCropPayload,
  options?: ListingArtworkPrintBuildOptions,
): Promise<Buffer | null> {
  const useWhite = listingArtworkLetterboxFillUsesWhite(options?.letterboxFill);
  const encoded = await cropAndEncodeListingArtwork(
    input,
    crop,
    Number.MAX_SAFE_INTEGER,
    options,
  );
  if (!encoded) return null;

  if (!useWhite && encoded.contentType === "image/jpeg") {
    return sharp(encoded.body).png().toBuffer();
  }
  return encoded.body;
}
