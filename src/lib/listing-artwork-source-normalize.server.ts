import sharp from "sharp";

const SHARP_INPUT = { failOn: "none" as const, limitInputPixels: false };

/** Apply EXIF orientation so pixel data matches what the browser cropper displayed. */
export async function normalizeListingArtworkSourceBuffer(input: Buffer): Promise<Buffer> {
  try {
    const raw = await sharp(input, SHARP_INPUT).metadata();
    if (!raw.width || !raw.height) return input;
    if ((raw.orientation ?? 1) === 1) return input;
    return await sharp(input, SHARP_INPUT).rotate().toBuffer();
  } catch {
    return input;
  }
}
