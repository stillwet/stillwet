import sharp from "sharp";
import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import {
  listingArtworkCropExtractRegionForRotatedImage,
  listingArtworkRotateSize,
} from "@/lib/listing-artwork-crop-math";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";

function padForOutOfBoundsCrop(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}): { padLeft: number; padTop: number; padRight: number; padBottom: number } {
  const leftEdge = params.x;
  const topEdge = params.y;
  const rightEdge = params.x + params.width;
  const bottomEdge = params.y + params.height;
  const padLeft = Math.max(0, Math.ceil(-leftEdge));
  const padTop = Math.max(0, Math.ceil(-topEdge));
  const padRight = Math.max(0, Math.ceil(rightEdge - params.canvasWidth));
  const padBottom = Math.max(0, Math.ceil(bottomEdge - params.canvasHeight));
  return { padLeft, padTop, padRight, padBottom };
}

/**
 * Crop + resize on the server (sharp). Matches browser crop dialog / canvas export.
 */
export async function cropListingArtworkBufferOnServer(
  input: Buffer,
  crop: ListingArtworkCropPayload,
): Promise<Buffer | null> {
  const { pixelCrop, rotation, printWidthPx, printHeightPx } = crop;

  try {
    const orientedPng = await sharp(input, { failOn: "none", limitInputPixels: false })
      .rotate()
      .png()
      .toBuffer();
    const orientedMeta = await sharp(orientedPng).metadata();
    const sourceWidthPx = orientedMeta.width;
    const sourceHeightPx = orientedMeta.height;
    if (!sourceWidthPx || !sourceHeightPx) return null;

    const expectedBbox = listingArtworkRotateSize(sourceWidthPx, sourceHeightPx, rotation);
    const bboxWidthPx = Math.max(1, Math.round(expectedBbox.width));
    const bboxHeightPx = Math.max(1, Math.round(expectedBbox.height));

    const baseBboxPng = await sharp({
      create: {
        width: bboxWidthPx,
        height: bboxHeightPx,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: orientedPng,
          left: Math.round((bboxWidthPx - sourceWidthPx) / 2),
          top: Math.round((bboxHeightPx - sourceHeightPx) / 2),
        },
      ])
      .png()
      .toBuffer();

    const rotatedPng =
      rotation % 360 !== 0
        ? await sharp(baseBboxPng)
            .rotate(rotation, {
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer()
        : baseBboxPng;

    const rotatedMeta = await sharp(rotatedPng).metadata();
    const rotatedWidthPx = rotatedMeta.width;
    const rotatedHeightPx = rotatedMeta.height;
    if (!rotatedWidthPx || !rotatedHeightPx) return null;

    const region = listingArtworkCropExtractRegionForRotatedImage({
      pixelCrop,
      sourceWidthPx,
      sourceHeightPx,
      rotationDeg: rotation,
      rotatedWidthPx,
      rotatedHeightPx,
      printWidthPx,
      printHeightPx,
    });
    if (!region) return null;

    const pads = padForOutOfBoundsCrop({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      canvasWidth: rotatedWidthPx,
      canvasHeight: rotatedHeightPx,
    });

    const paddedPng =
      pads.padLeft || pads.padTop || pads.padRight || pads.padBottom
        ? await sharp({
            create: {
              width: rotatedWidthPx + pads.padLeft + pads.padRight,
              height: rotatedHeightPx + pads.padTop + pads.padBottom,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
          })
            .composite([{ input: rotatedPng, left: pads.padLeft, top: pads.padTop }])
            .png()
            .toBuffer()
        : rotatedPng;

    const cropped = await sharp(paddedPng, { failOn: "none", limitInputPixels: false })
      .extract({
        left: Math.max(0, Math.round(region.x + pads.padLeft)),
        top: Math.max(0, Math.round(region.y + pads.padTop)),
        width: region.width,
        height: region.height,
      })
      .resize(printWidthPx, printHeightPx, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false,
      })
      .ensureAlpha()
      .png()
      .toBuffer();

    const meta = await sharp(cropped).metadata();
    if (
      !meta.width ||
      !meta.height ||
      !exportedImageMeetsPrintDimensions(meta.width, meta.height, printWidthPx, printHeightPx)
    ) {
      return null;
    }
    return cropped;
  } catch (e) {
    console.error("[listing-artwork-server-crop]", e);
    return null;
  }
}
