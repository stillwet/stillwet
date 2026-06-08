import type { CatalogArtworkSurface } from "@/lib/admin-catalog-artwork-template";

export type PillowSidesArtworkMode = "same" | "different";

/** Printify pillow print files often use one wide canvas (front | back at 2× width). */
export function pillowPrintAreaUsesCombinedSideBySideLayout(
  printAreaWidthPx: number,
  printAreaHeightPx: number,
): boolean {
  return (
    printAreaWidthPx > 0 &&
    printAreaHeightPx > 0 &&
    printAreaWidthPx === printAreaHeightPx * 2
  );
}

/** Per-face print dimensions for shop upload when the catalog stores a combined pillow file. */
export function pillowPerSidePrintAreaDimensions(params: {
  printAreaWidthPx: number;
  printAreaHeightPx: number;
}): { printAreaWidthPx: number; printAreaHeightPx: number } {
  const { printAreaWidthPx, printAreaHeightPx } = params;
  if (pillowPrintAreaUsesCombinedSideBySideLayout(printAreaWidthPx, printAreaHeightPx)) {
    return { printAreaWidthPx: printAreaHeightPx, printAreaHeightPx };
  }
  return { printAreaWidthPx, printAreaHeightPx };
}

export function normalizePillowCatalogArtworkSurfaces(
  surfaces: CatalogArtworkSurface[],
): CatalogArtworkSurface[] {
  if (surfaces.length === 0) return surfaces;
  const primary = surfaces[0]!;
  const perSide = pillowPerSidePrintAreaDimensions({
    printAreaWidthPx: primary.printAreaWidthPx,
    printAreaHeightPx: primary.printAreaHeightPx,
  });
  if (
    perSide.printAreaWidthPx === primary.printAreaWidthPx &&
    perSide.printAreaHeightPx === primary.printAreaHeightPx
  ) {
    return surfaces;
  }
  return surfaces.map((surface) => ({
    ...surface,
    printAreaWidthPx: perSide.printAreaWidthPx,
    printAreaHeightPx: perSide.printAreaHeightPx,
  }));
}

export function parsePillowListingArtworkFormFields(formData: FormData): {
  pillowDoubleSided: boolean;
  pillowSidesMode: PillowSidesArtworkMode;
} {
  const pillowDoubleSided =
    formData.get("pillowDoubleSided") === "1" || formData.get("pillowDoubleSided") === "true";
  const raw = String(formData.get("pillowSidesMode") ?? "").trim();
  const pillowSidesMode: PillowSidesArtworkMode = raw === "different" ? "different" : "same";
  return { pillowDoubleSided, pillowSidesMode };
}

function normalizedCatalogName(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Throw pillows, body pillows, and similar catalog items. */
export function catalogItemIsPillow(params: {
  catalogItemName?: string | null;
  categoryTagSlug?: string | null;
}): boolean {
  const slug = String(params.categoryTagSlug ?? "").trim().toLowerCase();
  if (slug.includes("pillow")) return true;
  const n = normalizedCatalogName(params.catalogItemName);
  if (!n) return false;
  if (/\b(body pillows?|bodypillows?|throw pillows?)\b/.test(n)) return true;
  return /\bpillows?\b/.test(n);
}

export type PillowListingArtworkSurfaces = {
  surfaces: CatalogArtworkSurface[];
  /** When true, front baked artwork is duplicated to back at submit. */
  duplicateFrontToBackOnSubmit: boolean;
};

/** Shop-owner pillow options: single-sided, same both sides, or different per side. */
export function resolvePillowListingArtworkSurfaces(params: {
  catalogSurfaces: CatalogArtworkSurface[];
  pillowDoubleSided: boolean;
  pillowSidesMode: PillowSidesArtworkMode;
}): PillowListingArtworkSurfaces {
  const front = params.catalogSurfaces.find((s) => s.id === "front") ?? params.catalogSurfaces[0];
  if (!front) {
    return { surfaces: [], duplicateFrontToBackOnSubmit: false };
  }

  if (!params.pillowDoubleSided) {
    return { surfaces: [front], duplicateFrontToBackOnSubmit: false };
  }

  if (params.pillowSidesMode === "same") {
    return { surfaces: [front], duplicateFrontToBackOnSubmit: true };
  }

  const catalogBack = params.catalogSurfaces.find((s) => s.id === "back");
  const back: CatalogArtworkSurface = catalogBack
    ? { ...catalogBack, required: true }
    : {
        ...front,
        id: "back",
        label: "Back",
        required: true,
      };

  return {
    surfaces: [
      { ...front, id: "front", label: "Front", required: true },
      back,
    ],
    duplicateFrontToBackOnSubmit: false,
  };
}

export type ListingArtworkBakedSubmitEntry = {
  surfaceId: string;
  requestImageKey: string;
  publicUrl: string;
};

export function buildListingArtworkBakedSubmitEntries(params: {
  surfaces: CatalogArtworkSurface[];
  surfaceArtwork: Record<string, { requestImageKey: string; publicUrl: string } | undefined>;
  duplicateFrontToBackOnSubmit: boolean;
}): ListingArtworkBakedSubmitEntry[] {
  const out: ListingArtworkBakedSubmitEntry[] = [];
  for (const surface of params.surfaces) {
    const entry = params.surfaceArtwork[surface.id];
    if (entry) {
      out.push({
        surfaceId: surface.id,
        requestImageKey: entry.requestImageKey,
        publicUrl: entry.publicUrl,
      });
    }
  }

  if (params.duplicateFrontToBackOnSubmit) {
    const front = params.surfaceArtwork.front;
    if (front && !out.some((e) => e.surfaceId === "back")) {
      out.push({
        surfaceId: "back",
        requestImageKey: front.requestImageKey,
        publicUrl: front.publicUrl,
      });
    }
  }

  return out;
}
