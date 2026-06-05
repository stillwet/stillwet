import sharp from "sharp";
import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import type { ListingArtworkCropArea } from "@/lib/listing-artwork-crop-math";
import {
  listingArtworkCropExtractRegionForRotatedImage,
  listingArtworkRotateSize,
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
};

export type ListingArtworkEncodedPrint = {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  fileExtension: "jpeg" | "png" | "webp";
  width: number;
  height: number;
};

const SHARP_INPUT = { failOn: "none" as const, limitInputPixels: false };

function transparentBackground(): { r: number; g: number; b: number; alpha: number } {
  return { r: 0, g: 0, b: 0, alpha: 0 };
}

function whiteBackground(): { r: number; g: number; b: number; alpha: number } {
  return { r: 255, g: 255, b: 255, alpha: 1 };
}

function printBackground(letterboxFill: ListingArtworkLetterboxFill | null | undefined) {
  return listingArtworkLetterboxFillUsesWhite(letterboxFill) ? whiteBackground() : transparentBackground();
}

/**
 * Maps bbox-space crop coords onto a print-sized canvas — same math as
 * `drawImage(rotated, cx, cy, cw, ch, 0, 0, printW, printH)` in
 * {@link renderListingArtworkCropCanvas}. Never allocates a buffer larger than print px.
 */
export function cropCompositePlacementOnPrint(
  rotatedWidthPx: number,
  rotatedHeightPx: number,
  crop: ListingArtworkCropArea,
  printWidthPx: number,
  printHeightPx: number,
): { left: number; top: number; scaledWidthPx: number; scaledHeightPx: number } {
  const cropWidthPx = crop.width;
  const cropHeightPx = crop.height;
  return {
    left: Math.round((-crop.x / cropWidthPx) * printWidthPx),
    top: Math.round((-crop.y / cropHeightPx) * printHeightPx),
    scaledWidthPx: Math.max(1, Math.round((rotatedWidthPx / cropWidthPx) * printWidthPx)),
    scaledHeightPx: Math.max(1, Math.round((rotatedHeightPx / cropHeightPx) * printHeightPx)),
  };
}

/** Clip a layer to the print canvas, matching browser drawImage overflow behavior. */
export function visibleCompositeSlice(params: {
  left: number;
  top: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}): { destLeft: number; destTop: number; srcLeft: number; srcTop: number; width: number; height: number } | null {
  const visibleLeft = Math.max(0, params.left);
  const visibleTop = Math.max(0, params.top);
  const visibleRight = Math.min(params.canvasWidth, params.left + params.width);
  const visibleBottom = Math.min(params.canvasHeight, params.top + params.height);
  const width = visibleRight - visibleLeft;
  const height = visibleBottom - visibleTop;
  if (width < 1 || height < 1) return null;
  return {
    destLeft: visibleLeft,
    destTop: visibleTop,
    srcLeft: visibleLeft - params.left,
    srcTop: visibleTop - params.top,
    width,
    height,
  };
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
 * Rotated bbox image as a compressed PNG (one decode pass, no full raw RGBA workspace).
 * Matches browser: center on bbox canvas, then rotate.
 */
async function buildRotatedImagePng(
  input: Buffer,
  sourceWidthPx: number,
  sourceHeightPx: number,
  rotation: number,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  if (rotation % 360 === 0) {
    const buffer = await sharp(input, SHARP_INPUT).rotate().png().toBuffer();
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) return null;
    return { buffer, width: meta.width, height: meta.height };
  }

  const expectedBbox = listingArtworkRotateSize(sourceWidthPx, sourceHeightPx, rotation);
  const bboxWidthPx = Math.max(1, Math.round(expectedBbox.width));
  const bboxHeightPx = Math.max(1, Math.round(expectedBbox.height));

  const oriented = await sharp(input, SHARP_INPUT).rotate().toBuffer();

  const rotated = await sharp({
    create: {
      width: bboxWidthPx,
      height: bboxHeightPx,
      channels: 4,
      background: transparentBackground(),
    },
  })
    .composite([
      {
        input: oriented,
        left: Math.round((bboxWidthPx - sourceWidthPx) / 2),
        top: Math.round((bboxHeightPx - sourceHeightPx) / 2),
      },
    ])
    .rotate(rotation, { background: transparentBackground() })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: rotated.data,
    width: rotated.info.width,
    height: rotated.info.height,
  };
}

/** Scaled + clipped artwork layer as PNG (small vs full print canvas). */
async function buildOverlayPng(
  rotatedPng: Buffer,
  placement: ReturnType<typeof cropCompositePlacementOnPrint>,
  slice: NonNullable<ReturnType<typeof visibleCompositeSlice>>,
): Promise<Buffer | null> {
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

    return await pipeline.png().toBuffer();
  } catch {
    return null;
  }
}

async function encodeWhitePrintJpeg(
  overlayPng: Buffer,
  destLeft: number,
  destTop: number,
  printWidthPx: number,
  printHeightPx: number,
  storedMaxBytes: number,
): Promise<ListingArtworkEncodedPrint | null> {
  const composite = [
    {
      input: overlayPng,
      left: destLeft,
      top: destTop,
    },
  ];

  let low = 52;
  let high = 92;
  let best: Buffer | null = null;

  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    const body = await sharp({
      create: {
        width: printWidthPx,
        height: printHeightPx,
        channels: 3,
        background: whiteBackground(),
      },
    })
      .composite(composite)
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
    const body = await sharp({
      create: {
        width: printWidthPx,
        height: printHeightPx,
        channels: 3,
        background: whiteBackground(),
      },
    })
      .composite(composite)
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

async function encodeTransparentPrint(
  overlayPng: Buffer,
  destLeft: number,
  destTop: number,
  printWidthPx: number,
  printHeightPx: number,
  storedMaxBytes: number,
): Promise<ListingArtworkEncodedPrint | null> {
  const base = () =>
    sharp({
      create: {
        width: printWidthPx,
        height: printHeightPx,
        channels: 4,
        background: transparentBackground(),
      },
    }).composite([
      {
        input: overlayPng,
        left: destLeft,
        top: destTop,
      },
    ]);

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
    if (sourceWidthPx * sourceHeightPx > LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS) return null;

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

    const placement = cropCompositePlacementOnPrint(
      rotated.width,
      rotated.height,
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

    const overlayPng = await buildOverlayPng(rotated.buffer, placement, slice);
    if (!overlayPng) return null;

    const encoded = useWhite
      ? await encodeWhitePrintJpeg(
          overlayPng,
          slice.destLeft,
          slice.destTop,
          printWidthPx,
          printHeightPx,
          storedMaxBytes,
        )
      : await encodeTransparentPrint(
          overlayPng,
          slice.destLeft,
          slice.destTop,
          printWidthPx,
          printHeightPx,
          storedMaxBytes,
        );

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
