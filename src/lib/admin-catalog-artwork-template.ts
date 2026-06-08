import type { CatalogCanvasPresentation } from "@/lib/admin-catalog-canvas-presentation";
import {
  CATALOG_CANVAS_PRESENTATION_FLAT,
  parseCatalogCanvasPresentation,
} from "@/lib/admin-catalog-canvas-presentation";
import type { ListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";

export type CatalogArtworkSurface = {
  id: string;
  label: string;
  required: boolean;
  printAreaWidthPx: number;
  printAreaHeightPx: number;
  minArtworkDpi?: number | null;
  letterboxFill?: ListingArtworkLetterboxFill | null;
  canvasPresentation: CatalogCanvasPresentation;
};

export type CatalogArtworkTemplate = {
  version: 1;
  surfaces: CatalogArtworkSurface[];
};

export function parseCatalogArtworkSurface(raw: unknown): CatalogArtworkSurface | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const label = String(o.label ?? "").trim();
  const required = o.required === true;
  const printAreaWidthPx = Number(o.printAreaWidthPx);
  const printAreaHeightPx = Number(o.printAreaHeightPx);
  if (
    !id ||
    !label ||
    !Number.isFinite(printAreaWidthPx) ||
    !Number.isFinite(printAreaHeightPx) ||
    printAreaWidthPx <= 0 ||
    printAreaHeightPx <= 0
  ) {
    return null;
  }
  const minArtworkDpiRaw = o.minArtworkDpi;
  const minArtworkDpi =
    minArtworkDpiRaw == null || minArtworkDpiRaw === ""
      ? null
      : Number(minArtworkDpiRaw);
  const canvasPresentation = parseCatalogCanvasPresentation(o.canvasPresentation ?? o.presentation);
  return {
    id,
    label,
    required,
    printAreaWidthPx,
    printAreaHeightPx,
    ...(minArtworkDpi != null && Number.isFinite(minArtworkDpi) && minArtworkDpi > 0
      ? { minArtworkDpi }
      : {}),
    canvasPresentation,
  };
}

export function parseCatalogArtworkTemplate(raw: unknown): CatalogArtworkTemplate | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return null;
  if (!Array.isArray(o.surfaces) || o.surfaces.length === 0) return null;
  const surfaces: CatalogArtworkSurface[] = [];
  for (const row of o.surfaces) {
    const surface = parseCatalogArtworkSurface(row);
    if (!surface) return null;
    surfaces.push(surface);
  }
  const ids = new Set(surfaces.map((s) => s.id));
  if (ids.size !== surfaces.length) return null;
  return { version: 1, surfaces };
}

export function catalogArtworkTemplateToDbJson(
  template: CatalogArtworkTemplate | null,
): CatalogArtworkTemplate | null {
  if (!template || template.surfaces.length === 0) return null;
  return template;
}

/** Dual-sided preset: front required, back optional — same W×H on both sides. */
export function buildDualSidedArtworkTemplate(params: {
  printAreaWidthPx: number;
  printAreaHeightPx: number;
  backOptional?: boolean;
  canvasPresentation?: CatalogCanvasPresentation;
}): CatalogArtworkTemplate {
  const presentation = params.canvasPresentation ?? CATALOG_CANVAS_PRESENTATION_FLAT;
  return {
    version: 1,
    surfaces: [
      {
        id: "front",
        label: "Front",
        required: true,
        printAreaWidthPx: params.printAreaWidthPx,
        printAreaHeightPx: params.printAreaHeightPx,
        canvasPresentation: presentation,
      },
      {
        id: "back",
        label: "Back",
        required: false,
        printAreaWidthPx: params.printAreaWidthPx,
        printAreaHeightPx: params.printAreaHeightPx,
        canvasPresentation: CATALOG_CANVAS_PRESENTATION_FLAT,
      },
    ],
  };
}

export type ResolvedCatalogArtworkSurfaces = {
  surfaces: CatalogArtworkSurface[];
  usesTemplate: boolean;
};

/** Prefer itemArtworkTemplate; else synthesize single front surface from item-level print area. */
export function resolveCatalogArtworkSurfaces(input: {
  itemArtworkTemplate: unknown;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
  itemMinArtworkDpi?: number | null;
  itemCanvasPresentation?: unknown;
}): ResolvedCatalogArtworkSurfaces {
  const parsed = parseCatalogArtworkTemplate(input.itemArtworkTemplate);
  if (parsed) {
    return { surfaces: parsed.surfaces, usesTemplate: true };
  }

  const canvasPresentation = parseCatalogCanvasPresentation(input.itemCanvasPresentation);
  const w = input.itemPrintAreaWidthPx;
  const h = input.itemPrintAreaHeightPx;
  if (w != null && h != null && w > 0 && h > 0) {
    return {
      usesTemplate: false,
      surfaces: [
        {
          id: "front",
          label: "Front",
          required: true,
          printAreaWidthPx: w,
          printAreaHeightPx: h,
          minArtworkDpi: input.itemMinArtworkDpi ?? null,
          canvasPresentation,
        },
      ],
    };
  }

  return {
    usesTemplate: false,
    surfaces: [],
  };
}

export function primaryCatalogArtworkSurface(
  resolved: ResolvedCatalogArtworkSurfaces,
): CatalogArtworkSurface | null {
  return resolved.surfaces[0] ?? null;
}
