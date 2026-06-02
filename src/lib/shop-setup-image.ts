import sharp from "sharp";
import { LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES } from "@/lib/listing-request-artwork-limits";

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

const LISTING_PLATFORM_MAX_BYTES = LISTING_REQUEST_ARTWORK_PLATFORM_MAX_BYTES;

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

/**
 * Listing request artwork for admin / print review — **not** compressed to ~100 KiB like storefront images.
 * Stores the uploaded PNG, JPEG, or WebP bytes as-is when within `maxBytes` (per catalog item).
 */
export async function prepareListingRequestArtworkUpload(
  input: Buffer,
  maxBytes: number = LISTING_PLATFORM_MAX_BYTES,
): Promise<ListingRequestArtworkUpload | null> {
  if (input.length > maxBytes) return null;
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    if (meta.format === "svg" || meta.format === "gif") return null;
    if (input.length > maxBytes) return null;

    if (meta.format === "png") {
      return { body: input, contentType: "image/png", fileExtension: "png" };
    }
    if (meta.format === "jpeg" || meta.format === "jpg") {
      return { body: input, contentType: "image/jpeg", fileExtension: "jpeg" };
    }
    if (meta.format === "webp") {
      return { body: input, contentType: "image/webp", fileExtension: "webp" };
    }
    return null;
  } catch {
    return null;
  }
}
