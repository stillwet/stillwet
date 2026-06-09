import { computeListingArtworkCropViewportSize } from "@/lib/listing-artwork-crop-viewport";
import type { CatalogArtworkTemplate } from "@/lib/admin-catalog-artwork-template";
import { buildDualSidedArtworkTemplate, catalogArtworkTemplateToDbJson } from "@/lib/admin-catalog-artwork-template";

export type CatalogCanvasPresentationFlat = { type: "flat" };

export type CatalogCanvasPresentationWraparound = {
  type: "wraparound";
  verticalGuideFractions: number[];
  orientationPreviews: {
    label?: string;
    assetKey: string;
    alignGuideIndex: number;
  }[];
  safeAreaInsetFraction?: { x: number; y: number };
};

export type CatalogCanvasPresentationShapeOutline = {
  type: "shapeOutline";
  outlineAssetKey: string;
};

export type CatalogCanvasPresentation =
  | CatalogCanvasPresentationFlat
  | CatalogCanvasPresentationWraparound
  | CatalogCanvasPresentationShapeOutline;

export const CATALOG_CANVAS_PRESENTATION_FLAT: CatalogCanvasPresentationFlat = { type: "flat" };

/** Admin dropdown preset ids. */
export type CatalogCanvasPresentationPresetId = "flat" | "wraparound_mug_3view" | "shape_outline_tee";

export type CatalogArtworkTemplatePresetId = "none" | "dual_sided";

export const CATALOG_CANVAS_PRESENTATION_WRAPAROUND_MUG_3VIEW: CatalogCanvasPresentationWraparound = {
  type: "wraparound",
  verticalGuideFractions: [0.25, 0.5, 0.75],
  orientationPreviews: [
    { label: "Left", assetKey: "mug-white-handle-left", alignGuideIndex: 0 },
    { label: "Center", assetKey: "mug-white-handle-center", alignGuideIndex: 1 },
    { label: "Right", assetKey: "mug-white-handle-right", alignGuideIndex: 2 },
  ],
};

export const CATALOG_CANVAS_PRESENTATION_SHAPE_OUTLINE_TEE: CatalogCanvasPresentationShapeOutline = {
  type: "shapeOutline",
  outlineAssetKey: "tee-front-outline",
};

export function catalogCanvasPresentationFromPreset(
  preset: CatalogCanvasPresentationPresetId,
): CatalogCanvasPresentation {
  switch (preset) {
    case "wraparound_mug_3view":
      return CATALOG_CANVAS_PRESENTATION_WRAPAROUND_MUG_3VIEW;
    case "shape_outline_tee":
      return CATALOG_CANVAS_PRESENTATION_SHAPE_OUTLINE_TEE;
    case "flat":
    default:
      return CATALOG_CANVAS_PRESENTATION_FLAT;
  }
}

export function catalogCanvasPresentationPresetIdFromPresentation(
  presentation: CatalogCanvasPresentation | null | undefined,
): CatalogCanvasPresentationPresetId {
  if (!presentation || presentation.type === "flat") return "flat";
  if (presentation.type === "shapeOutline") {
    return presentation.outlineAssetKey === CATALOG_CANVAS_PRESENTATION_SHAPE_OUTLINE_TEE.outlineAssetKey
      ? "shape_outline_tee"
      : "flat";
  }
  if (presentation.type === "wraparound") {
    const mug = CATALOG_CANVAS_PRESENTATION_WRAPAROUND_MUG_3VIEW;
    const sameGuides =
      presentation.verticalGuideFractions.length === mug.verticalGuideFractions.length &&
      presentation.verticalGuideFractions.every((f, i) => Math.abs(f - mug.verticalGuideFractions[i]!) < 0.001);
    const samePreviews =
      presentation.orientationPreviews.length === mug.orientationPreviews.length &&
      presentation.orientationPreviews.every(
        (p, i) =>
          p.assetKey === mug.orientationPreviews[i]!.assetKey &&
          p.alignGuideIndex === mug.orientationPreviews[i]!.alignGuideIndex,
      );
    if (sameGuides && samePreviews) return "wraparound_mug_3view";
  }
  return "flat";
}

function parseGuideFractions(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: number[] = [];
  for (const x of raw) {
    const n = Number(x);
    if (!Number.isFinite(n) || n < 0 || n > 1) return null;
    out.push(n);
  }
  return out;
}

function parseOrientationPreviews(raw: unknown): CatalogCanvasPresentationWraparound["orientationPreviews"] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: CatalogCanvasPresentationWraparound["orientationPreviews"] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const assetKey = String(o.assetKey ?? "").trim();
    const alignGuideIndex = Number(o.alignGuideIndex);
    if (!assetKey || !Number.isInteger(alignGuideIndex) || alignGuideIndex < 0) return null;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
    out.push({ assetKey, alignGuideIndex, ...(label ? { label } : {}) });
  }
  return out;
}

export function parseCatalogCanvasPresentation(raw: unknown): CatalogCanvasPresentation {
  if (raw == null) return CATALOG_CANVAS_PRESENTATION_FLAT;
  if (typeof raw !== "object") return CATALOG_CANVAS_PRESENTATION_FLAT;
  const o = raw as Record<string, unknown>;
  const type = String(o.type ?? "").trim();

  if (type === "wraparound") {
    const verticalGuideFractions = parseGuideFractions(o.verticalGuideFractions);
    const orientationPreviews = parseOrientationPreviews(o.orientationPreviews);
    if (!verticalGuideFractions || !orientationPreviews) return CATALOG_CANVAS_PRESENTATION_FLAT;
    let safeAreaInsetFraction: { x: number; y: number } | undefined;
    if (o.safeAreaInsetFraction && typeof o.safeAreaInsetFraction === "object") {
      const s = o.safeAreaInsetFraction as Record<string, unknown>;
      const x = Number(s.x);
      const y = Number(s.y);
      if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < 0.5 && y < 0.5) {
        safeAreaInsetFraction = { x, y };
      }
    }
    return {
      type: "wraparound",
      verticalGuideFractions,
      orientationPreviews,
      ...(safeAreaInsetFraction ? { safeAreaInsetFraction } : {}),
    };
  }

  if (type === "shapeOutline") {
    const outlineAssetKey = String(o.outlineAssetKey ?? "").trim();
    if (!outlineAssetKey) return CATALOG_CANVAS_PRESENTATION_FLAT;
    return { type: "shapeOutline", outlineAssetKey };
  }

  return CATALOG_CANVAS_PRESENTATION_FLAT;
}

/** JSON-safe value for Prisma when preset is flat (store null). */
export function catalogCanvasPresentationToDbJson(
  presentation: CatalogCanvasPresentation,
): CatalogCanvasPresentation | null {
  if (presentation.type === "flat") return null;
  return presentation;
}

export function catalogArtworkAssetPublicUrl(assetKey: string): string {
  const key = assetKey.trim();
  if (!key) return "";
  if (key.endsWith(".svg") || key.endsWith(".webp") || key.endsWith(".png")) {
    return `/catalog-artwork/${key}`;
  }
  return `/catalog-artwork/${key}.svg`;
}

export type ListingArtworkCropFrameRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Centered crop frame within the compose dialog container (matches react-easy-crop layout). */
export function computeListingArtworkCropFrameRect(
  containerWidth: number,
  containerHeight: number,
  aspect: number,
): ListingArtworkCropFrameRect | null {
  const size = computeListingArtworkCropViewportSize(containerWidth, containerHeight, aspect);
  if (!size) return null;
  return {
    left: (containerWidth - size.width) / 2,
    top: (containerHeight - size.height) / 2,
    width: size.width,
    height: size.height,
  };
}

export function guideXInContainer(cropFrame: ListingArtworkCropFrameRect, fraction: number): number {
  return cropFrame.left + cropFrame.width * fraction;
}

export function parseAdminCatalogCanvasPresentationPreset(
  raw: string | null | undefined,
): CatalogCanvasPresentationPresetId {
  const v = String(raw ?? "").trim();
  if (v === "wraparound_mug_3view" || v === "shape_outline_tee" || v === "flat") return v;
  return "flat";
}

export function parseAdminCatalogArtworkTemplatePreset(
  raw: string | null | undefined,
): CatalogArtworkTemplatePresetId {
  const v = String(raw ?? "").trim();
  return v === "dual_sided" ? "dual_sided" : "none";
}

export function buildAdminCatalogArtworkTemplateFromPresets(params: {
  templatePreset: CatalogArtworkTemplatePresetId;
  printAreaWidthPx: number | null;
  printAreaHeightPx: number | null;
  canvasPresentation: CatalogCanvasPresentation;
}): CatalogArtworkTemplate | null {
  const w = params.printAreaWidthPx;
  const h = params.printAreaHeightPx;
  if (params.templatePreset !== "dual_sided" || w == null || h == null || w <= 0 || h <= 0) {
    return null;
  }
  return buildDualSidedArtworkTemplate({
    printAreaWidthPx: w,
    printAreaHeightPx: h,
    canvasPresentation: params.canvasPresentation,
  });
}

export function catalogArtworkTemplateToDbJsonFromPresets(params: {
  templatePreset: CatalogArtworkTemplatePresetId;
  printAreaWidthPx: number | null;
  printAreaHeightPx: number | null;
  canvasPresentation: CatalogCanvasPresentation;
}): CatalogArtworkTemplate | null {
  const template = buildAdminCatalogArtworkTemplateFromPresets(params);
  return catalogArtworkTemplateToDbJson(template);
}

export function catalogArtworkTemplatePresetFromJson(raw: unknown): CatalogArtworkTemplatePresetId {
  if (raw == null) return "none";
  if (typeof raw !== "object") return "none";
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1 || !Array.isArray(o.surfaces)) return "none";
  return o.surfaces.length > 1 ? "dual_sided" : "none";
}
