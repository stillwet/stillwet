import { effectiveArtworkDpiFromCropAndPrint } from "@/lib/listing-artwork-print-area";
import {
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS,
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES,
} from "@/lib/listing-request-artwork-limits";

/** Resolved tier shown in the shop catalog picker. */
export type CatalogArtworkSourceTier = "phone_pic_safe" | "camera_or_vector_only";

/** Admin override stored on {@link AdminCatalogItem}. */
export type CatalogArtworkSourceTierOverride = "auto" | CatalogArtworkSourceTier;

/** Reference modern phone photo dimensions (portrait). Landscape is the swap. */
export const PHONE_PIC_REFERENCE_WIDTH_PX = 3024;
export const PHONE_PIC_REFERENCE_HEIGHT_PX = 4032;

/**
 * Minimum effective DPI from a reference phone photo at full-bleed cover crop to classify as phone-safe.
 * Below this → camera / vector only.
 */
export const PHONE_PIC_SAFE_MIN_EFFECTIVE_DPI = 250;

export const CATALOG_ARTWORK_SOURCE_TIER_LABELS: Record<CatalogArtworkSourceTier, string> = {
  phone_pic_safe: "Phone pic safe",
  camera_or_vector_only: "Camera / vector only",
};

export const CATALOG_ARTWORK_SOURCE_TIER_GUIDANCE: Record<CatalogArtworkSourceTier, string> = {
  phone_pic_safe:
    "Typical phone photos usually work for this print size. You can still use higher-resolution art if you have it.",
  camera_or_vector_only:
    "Use a high-resolution camera photo, scan, or vector art. Phone photos may look soft when printed at this size.",
};

/** Largest cover crop of print aspect ratio inside a source image (source pixels). */
export function coverCropPixelsForPrintAspect(
  sourceW: number,
  sourceH: number,
  printW: number,
  printH: number,
): { cropW: number; cropH: number } | null {
  if (!(sourceW > 0) || !(sourceH > 0) || !(printW > 0) || !(printH > 0)) return null;
  const printAspect = printW / printH;
  const sourceAspect = sourceW / sourceH;
  if (printAspect > sourceAspect) {
    return { cropW: sourceW, cropH: sourceW * (printH / printW) };
  }
  return { cropH: sourceH, cropW: sourceH * (printW / printH) };
}

/** Best effective DPI a reference phone photo can achieve at full-bleed cover for this print area. */
export function referencePhoneEffectiveDpiForPrint(
  printW: number,
  printH: number,
): number | null {
  const orientations: Array<[number, number]> = [
    [PHONE_PIC_REFERENCE_WIDTH_PX, PHONE_PIC_REFERENCE_HEIGHT_PX],
    [PHONE_PIC_REFERENCE_HEIGHT_PX, PHONE_PIC_REFERENCE_WIDTH_PX],
  ];
  let best: number | null = null;
  for (const [sw, sh] of orientations) {
    const crop = coverCropPixelsForPrintAspect(sw, sh, printW, printH);
    if (!crop) continue;
    const dpi = effectiveArtworkDpiFromCropAndPrint(crop.cropW, crop.cropH, printW, printH);
    if (dpi == null) continue;
    if (best == null || dpi > best) best = dpi;
  }
  return best;
}

/** Auto tier from print dimensions; defaults to phone-safe when print area is unknown. */
export function computedCatalogArtworkSourceTier(
  printW: number | null,
  printH: number | null,
): CatalogArtworkSourceTier {
  if (printW == null || printH == null || printW <= 0 || printH <= 0) {
    return "phone_pic_safe";
  }
  const dpi = referencePhoneEffectiveDpiForPrint(printW, printH);
  if (dpi == null) return "phone_pic_safe";
  return dpi + 0.01 >= PHONE_PIC_SAFE_MIN_EFFECTIVE_DPI
    ? "phone_pic_safe"
    : "camera_or_vector_only";
}

export function resolveCatalogArtworkSourceTier(input: {
  itemArtworkSourceTierOverride: CatalogArtworkSourceTierOverride;
  printAreaWidthPx: number | null;
  printAreaHeightPx: number | null;
}): CatalogArtworkSourceTier {
  const override = input.itemArtworkSourceTierOverride;
  if (override === "phone_pic_safe" || override === "camera_or_vector_only") {
    return override;
  }
  return computedCatalogArtworkSourceTier(input.printAreaWidthPx, input.printAreaHeightPx);
}

export function parseCatalogArtworkSourceTierOverride(
  raw: string,
): CatalogArtworkSourceTierOverride {
  const t = raw.trim();
  if (t === "phone_pic_safe" || t === "camera_or_vector_only") return t;
  return "auto";
}

export function listingArtworkDecodeMaxPixelsForSourceTier(
  tier: CatalogArtworkSourceTier,
): number {
  if (tier === "camera_or_vector_only") {
    return LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES;
  }
  return LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS;
}
