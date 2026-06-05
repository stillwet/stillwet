import sharp from "sharp";
import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";

/**
 * Crop + resize on the server (sharp). Matches browser crop dialog output dimensions.
 */
export async function cropListingArtworkBufferOnServer(
  input: Buffer,
  crop: ListingArtworkCropPayload,
): Promise<Buffer | null> {
  const { pixelCrop, rotation, printWidthPx, printHeightPx } = crop;
  const left = Math.max(0, Math.round(pixelCrop.x));
  const top = Math.max(0, Math.round(pixelCrop.y));
  const width = Math.max(1, Math.round(pixelCrop.width));
  const height = Math.max(1, Math.round(pixelCrop.height));

  try {
    let pipeline = sharp(input, { failOn: "none", limitInputPixels: false }).rotate();
    if (rotation % 360 !== 0) {
      pipeline = pipeline.rotate(rotation);
    }
    const cropped = await pipeline
      .extract({ left, top, width, height })
      .resize(printWidthPx, printHeightPx, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false,
      })
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
