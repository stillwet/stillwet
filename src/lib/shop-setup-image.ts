import sharp from "sharp";
import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";
import { cropAndEncodeListingArtwork } from "@/lib/listing-artwork-server-crop";
import {
  listingArtworkLetterboxFillUsesWhite,
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";
import {
  LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES,
  LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES,
} from "@/lib/listing-request-artwork-limits";

/**
 * Site image compression tiers:
 * - **~100 KiB WebP** — shop profile avatar, optional listing supplement photos, admin listing
 *   secondary images, bug/feedback screenshots (fast storefront loads).
 * - **Listing request artwork** — {@link prepareListingRequestArtworkUpload} in this module (server only);
 *   limits in `listing-request-artwork-limits.ts`.
 */

const PROFILE_MAX_BYTES = 100 * 1024;
/** Optional per-listing owner photo on the storefront (same cap as profile avatar). */
const LISTING_SUPPLEMENT_MAX_BYTES = 100 * 1024;
const LISTING_SUPPLEMENT_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const LISTING_UPLOAD_MAX_BYTES = LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES;

/** Avatar for shop profile: WebP, must fit under 100 KiB. */
export async function compressShopProfileImageWebp(
  input: Buffer,
): Promise<Buffer | null> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    if (meta.format === "svg") return null;

    const tryEncode = async (maxDim: number, quality: number) =>
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({
          width: maxDim,
          height: maxDim,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();

    let q = 82;
    let maxDim = 512;
    let buf = await tryEncode(maxDim, q);
    while (buf.length > PROFILE_MAX_BYTES && q > 40) {
      q -= 6;
      buf = await tryEncode(maxDim, q);
    }
    while (buf.length > PROFILE_MAX_BYTES && maxDim > 160) {
      maxDim = Math.floor(maxDim * 0.85);
      buf = await tryEncode(maxDim, Math.max(q, 45));
    }
    if (buf.length > PROFILE_MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

/** One optional owner listing photo: WebP, max 100 KiB (dashboard → storefront gallery). */
export async function compressShopListingSupplementPhotoWebp(
  input: Buffer,
): Promise<Buffer | null> {
  if (input.length > LISTING_SUPPLEMENT_MAX_SOURCE_BYTES) return null;
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    if (meta.format === "svg") return null;

    const tryEncode = async (maxDim: number, quality: number) =>
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({
          width: maxDim,
          height: maxDim,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();

    let q = 82;
    let maxDim = 1200;
    let buf = await tryEncode(maxDim, q);
    while (buf.length > LISTING_SUPPLEMENT_MAX_BYTES && q > 40) {
      q -= 6;
      buf = await tryEncode(maxDim, q);
    }
    while (buf.length > LISTING_SUPPLEMENT_MAX_BYTES && maxDim > 160) {
      maxDim = Math.floor(maxDim * 0.85);
      buf = await tryEncode(maxDim, Math.max(q, 45));
    }
    if (buf.length > LISTING_SUPPLEMENT_MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

export type ListingRequestArtworkUpload = {
  body: Buffer;
  contentType: "image/webp" | "image/png" | "image/jpeg";
  fileExtension: "webp" | "png" | "jpeg";
};

function listingArtworkUploadFromBuffer(
  body: Buffer,
  format: string | undefined,
): ListingRequestArtworkUpload | null {
  if (format === "png") {
    return { body, contentType: "image/png", fileExtension: "png" };
  }
  if (format === "jpeg" || format === "jpg") {
    return { body, contentType: "image/jpeg", fileExtension: "jpeg" };
  }
  if (format === "webp") {
    return { body, contentType: "image/webp", fileExtension: "webp" };
  }
  return null;
}

async function readListingArtworkDimensions(
  input: Buffer,
): Promise<{ w: number; h: number; format: string | undefined; hasAlpha: boolean } | null> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const w = meta.width;
    const h = meta.height;
    if (w == null || h == null || w < 1 || h < 1) return null;
    if (meta.format === "svg" || meta.format === "gif") return null;
    return { w, h, format: meta.format, hasAlpha: meta.hasAlpha === true };
  } catch {
    return null;
  }
}

function dimensionsPreserved(
  w: number,
  h: number,
  printW: number | null | undefined,
  printH: number | null | undefined,
): boolean {
  if (printW != null && printH != null && printW > 0 && printH > 0) {
    return exportedImageMeetsPrintDimensions(w, h, printW, printH);
  }
  return true;
}

function rawRgbaHasAlpha(data: Buffer): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true;
  }
  return false;
}

/**
 * Encode raw RGBA print pixels for R2: alpha-safe encodings first, then JPEG fallbacks.
 */
export async function encodeListingArtworkRgbaForStorage(
  data: Buffer,
  width: number,
  height: number,
  storedMaxBytes: number = LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES,
  letterboxFill?: ListingArtworkLetterboxFill | null,
): Promise<ListingRequestArtworkUpload | null> {
  const fromRaw = () => sharp(data, { raw: { width, height, channels: 4 } });
  const hasAlpha = rawRgbaHasAlpha(data);
  const preferOpaqueEncoding = listingArtworkLetterboxFillUsesWhite(letterboxFill);

  type Attempt = () => Promise<ListingRequestArtworkUpload | null>;
  const attempts: Attempt[] = [];

  if (preferOpaqueEncoding) {
    for (let q = 92; q >= 58; q -= 6) {
      const quality = q;
      attempts.push(async () => {
        const body = await fromRaw().jpeg({ quality, mozjpeg: true }).toBuffer();
        if (body.length > storedMaxBytes) return null;
        const dims = await readListingArtworkDimensions(body);
        if (!dims || dims.w !== width || dims.h !== height) return null;
        return { body, contentType: "image/jpeg", fileExtension: "jpeg" };
      });
    }

    for (let q = 92; q >= 58; q -= 6) {
      const quality = q;
      attempts.push(async () => {
        const body = await fromRaw().webp({ quality, effort: 4 }).toBuffer();
        if (body.length > storedMaxBytes) return null;
        const dims = await readListingArtworkDimensions(body);
        if (!dims || dims.w !== width || dims.h !== height) return null;
        return { body, contentType: "image/webp", fileExtension: "webp" };
      });
    }
  }

  attempts.push(async () => {
    const body = await fromRaw()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    if (body.length > storedMaxBytes) return null;
    const dims = await readListingArtworkDimensions(body);
    if (!dims || dims.w !== width || dims.h !== height) return null;
    return { body, contentType: "image/png", fileExtension: "png" };
  });

  for (let q = 92; q >= 58; q -= 6) {
    const quality = q;
    attempts.push(async () => {
      const body = await fromRaw()
        .webp({ quality, effort: 4, alphaQuality: quality })
        .toBuffer();
      if (body.length > storedMaxBytes) return null;
      const dims = await readListingArtworkDimensions(body);
      if (!dims || dims.w !== width || dims.h !== height) return null;
      return { body, contentType: "image/webp", fileExtension: "webp" };
    });
  }

  if (!hasAlpha) {
    for (let q = 90; q >= 62; q -= 7) {
      const quality = q;
      attempts.push(async () => {
        const body = await fromRaw().jpeg({ quality, mozjpeg: true }).toBuffer();
        if (body.length > storedMaxBytes) return null;
        const dims = await readListingArtworkDimensions(body);
        if (!dims || dims.w !== width || dims.h !== height) return null;
        return { body, contentType: "image/jpeg", fileExtension: "jpeg" };
      });
    }
  }

  for (let q = 90; q >= 62; q -= 7) {
    const quality = q;
    attempts.push(async () => {
      const body = await fromRaw()
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (body.length > storedMaxBytes) return null;
      const dims = await readListingArtworkDimensions(body);
      if (!dims || dims.w !== width || dims.h !== height) return null;
      return { body, contentType: "image/jpeg", fileExtension: "jpeg" };
    });
  }

  for (const attempt of attempts) {
    const result = await attempt();
    if (result) return result;
  }

  return null;
}

/**
 * Server crop + encode in one pass (avoids intermediate PNG between crop and storage).
 */
export async function cropAndPrepareListingArtworkForStorage(
  input: Buffer,
  crop: ListingArtworkCropPayload,
  storedMaxBytes: number = LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES,
  printW?: number | null,
  printH?: number | null,
  letterboxFill?: ListingArtworkLetterboxFill | null,
): Promise<ListingRequestArtworkUpload | null> {
  if (input.length > LISTING_UPLOAD_MAX_BYTES) return null;

  const encoded = await cropAndEncodeListingArtwork(input, crop, storedMaxBytes, { letterboxFill });
  if (!encoded) return null;
  if (!dimensionsPreserved(encoded.width, encoded.height, printW, printH)) return null;

  return {
    body: encoded.body,
    contentType: encoded.contentType,
    fileExtension: encoded.fileExtension,
  };
}

/**
 * Encode listing artwork for R2: pass-through when under `storedMaxBytes`, otherwise compress
 * without changing pixel dimensions (DPI/crop was validated earlier on the source).
 */
export async function prepareListingRequestArtworkForStorage(
  input: Buffer,
  storedMaxBytes: number = LISTING_REQUEST_ARTWORK_STORED_MAX_BYTES,
  printW?: number | null,
  printH?: number | null,
): Promise<ListingRequestArtworkUpload | null> {
  if (input.length > LISTING_UPLOAD_MAX_BYTES) return null;

  const source = await readListingArtworkDimensions(input);
  if (!source) return null;
  if (!dimensionsPreserved(source.w, source.h, printW, printH)) return null;

  if (input.length <= storedMaxBytes) {
    return listingArtworkUploadFromBuffer(input, source.format);
  }

  const oriented = () => sharp(input, { failOn: "none" }).rotate();

  type Attempt = () => Promise<ListingRequestArtworkUpload | null>;

  const attempts: Attempt[] = [];

  // Alpha-safe encodings first (letterbox margin survives into R2).
  attempts.push(async () => {
    const body = await oriented()
      .ensureAlpha()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    const dims = await readListingArtworkDimensions(body);
    if (!dims || !dimensionsPreserved(dims.w, dims.h, printW, printH)) return null;
    if (body.length > storedMaxBytes) return null;
    return { body, contentType: "image/png", fileExtension: "png" };
  });

  for (let q = 92; q >= 58; q -= 6) {
    const quality = q;
    attempts.push(async () => {
      const body = await oriented()
        .ensureAlpha()
        .webp({ quality, effort: 4, alphaQuality: quality })
        .toBuffer();
      const dims = await readListingArtworkDimensions(body);
      if (!dims || !dimensionsPreserved(dims.w, dims.h, printW, printH)) return null;
      if (body.length > storedMaxBytes) return null;
      return { body, contentType: "image/webp", fileExtension: "webp" };
    });
  }

  if (!source.hasAlpha) {
    for (let q = 90; q >= 62; q -= 7) {
      const quality = q;
      attempts.push(async () => {
        const body = await oriented().jpeg({ quality, mozjpeg: true }).toBuffer();
        const dims = await readListingArtworkDimensions(body);
        if (!dims || !dimensionsPreserved(dims.w, dims.h, printW, printH)) return null;
        if (body.length > storedMaxBytes) return null;
        return { body, contentType: "image/jpeg", fileExtension: "jpeg" };
      });
    }
  }

  // Last resort: flatten transparency to white (destroys letterbox).
  for (let q = 90; q >= 62; q -= 7) {
    const quality = q;
    attempts.push(async () => {
      const body = await oriented()
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      const dims = await readListingArtworkDimensions(body);
      if (!dims || !dimensionsPreserved(dims.w, dims.h, printW, printH)) return null;
      if (body.length > storedMaxBytes) return null;
      return { body, contentType: "image/jpeg", fileExtension: "jpeg" };
    });
  }

  for (const attempt of attempts) {
    const result = await attempt();
    if (result) return result;
  }

  return null;
}

/**
 * @deprecated Use {@link prepareListingRequestArtworkForStorage}.
 */
export async function prepareListingRequestArtworkUpload(
  input: Buffer,
  maxBytes: number = LISTING_UPLOAD_MAX_BYTES,
): Promise<ListingRequestArtworkUpload | null> {
  return prepareListingRequestArtworkForStorage(input, maxBytes, null, null);
}
