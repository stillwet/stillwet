/** Crop rectangle from react-easy-crop (pixels in rotated-image bounding-box space). */
export type ListingArtworkCropPixelArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ListingArtworkCropPayload = {
  pixelCrop: ListingArtworkCropPixelArea;
  rotation: number;
  printWidthPx: number;
  printHeightPx: number;
};

export function parseListingArtworkCropPayload(raw: unknown): ListingArtworkCropPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pixelCrop = o.pixelCrop;
  if (!pixelCrop || typeof pixelCrop !== "object") return null;
  const c = pixelCrop as Record<string, unknown>;
  const x = Number(c.x);
  const y = Number(c.y);
  const width = Number(c.width);
  const height = Number(c.height);
  const rotation = Number(o.rotation);
  const printWidthPx = Number(o.printWidthPx);
  const printHeightPx = Number(o.printHeightPx);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(rotation) ||
    !Number.isFinite(printWidthPx) ||
    !Number.isFinite(printHeightPx) ||
    printWidthPx <= 0 ||
    printHeightPx <= 0
  ) {
    return null;
  }
  return {
    pixelCrop: { x, y, width, height },
    rotation,
    printWidthPx: Math.round(printWidthPx),
    printHeightPx: Math.round(printHeightPx),
  };
}

export type ListingArtworkCropCompleteResult =
  | { mode: "file"; file: File }
  | {
      mode: "serverCrop";
      crop: ListingArtworkCropPayload;
      sourceFile: File;
    };

export function listingArtworkCropPayloadFromForm(formData: FormData): ListingArtworkCropPayload | null {
  const raw = String(formData.get("listingArtworkCropJson") ?? "").trim();
  if (!raw) return null;
  try {
    return parseListingArtworkCropPayload(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}
