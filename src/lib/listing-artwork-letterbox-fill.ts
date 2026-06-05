import type { CSSProperties } from "react";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";

export type { ListingArtworkLetterboxFill };

export const LISTING_ARTWORK_LETTERBOX_FILL_VALUES = [
  ListingArtworkLetterboxFill.transparent,
  ListingArtworkLetterboxFill.white,
] as const;

/** Print templates at or above this area use white letterbox + JPEG-first storage (unless apparel). */
export const LARGE_PRINT_AREA_LETTERBOX_MIN_PIXELS = 6_000_000;

export const WHITE_LETTERBOX_CATALOG_NAME_KEYWORDS = [
  "canvas",
  "poster",
  "gloss",
  "towel",
  "paper",
  "blanket",
  "body pillow",
  "bodypillow",
  "throw pillow",
  "fleece",
  "tapestry",
  "wall art",
  "sherpa",
  "duvet",
  "comforter",
  "quilt",
  "bed sheet",
  "sheet set",
  "banner",
  "flag",
  "bath mat",
  "floor mat",
  "yard sign",
  "acrylic",
  "metal print",
  "wood print",
  "framed",
  "rug",
] as const;

export const TRANSPARENT_LETTERBOX_CATALOG_NAME_KEYWORDS = [
  "mug",
  "tee",
  "shirt",
  "hoodie",
  "apparel",
  "tank",
  "sticker",
  "phone case",
  "tote",
  "tote bag",
  "bag",
  "hat",
  "cap",
  "sock",
  "sweatshirt",
  "long sleeve",
  "crop top",
  "legging",
  "brief",
  "thong",
  "panty",
  "boxer",
  "bikini",
  "swimsuit",
  "pin",
  "patch",
  "embroidery",
] as const;

function normalizedCatalogName(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function catalogNameIncludesKeyword(name: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => name.includes(kw));
}

export function listingArtworkLetterboxFillUsesWhite(
  fill: ListingArtworkLetterboxFill | null | undefined,
): boolean {
  return fill === ListingArtworkLetterboxFill.white;
}

export function parseAdminCatalogLetterboxFill(raw: string): ListingArtworkLetterboxFill {
  const t = raw.trim();
  if (t === ListingArtworkLetterboxFill.white) return ListingArtworkLetterboxFill.white;
  return ListingArtworkLetterboxFill.transparent;
}

export function catalogItemNameSuggestsTransparentLetterbox(name: string | null | undefined): boolean {
  const n = normalizedCatalogName(name);
  if (!n) return false;
  return catalogNameIncludesKeyword(n, TRANSPARENT_LETTERBOX_CATALOG_NAME_KEYWORDS);
}

export function catalogItemNameSuggestsWhiteLetterbox(name: string | null | undefined): boolean {
  const n = normalizedCatalogName(name);
  if (!n) return false;
  if (catalogItemNameSuggestsTransparentLetterbox(n)) return false;
  return catalogNameIncludesKeyword(n, WHITE_LETTERBOX_CATALOG_NAME_KEYWORDS);
}

export function printAreaSuggestsWhiteLetterbox(
  printAreaWidthPx: number | null | undefined,
  printAreaHeightPx: number | null | undefined,
): boolean {
  const w = printAreaWidthPx ?? 0;
  const h = printAreaHeightPx ?? 0;
  if (w < 1 || h < 1) return false;
  return w * h >= LARGE_PRINT_AREA_LETTERBOX_MIN_PIXELS;
}

export function defaultLetterboxFillForCatalogItemName(
  name: string | null | undefined,
): ListingArtworkLetterboxFill {
  return catalogItemNameSuggestsWhiteLetterbox(name)
    ? ListingArtworkLetterboxFill.white
    : ListingArtworkLetterboxFill.transparent;
}

export function resolveListingArtworkLetterboxFill(params: {
  itemArtworkLetterboxFill?: ListingArtworkLetterboxFill | null;
  itemLargeListingArtwork?: boolean | null;
  catalogItemName?: string | null;
  printAreaWidthPx?: number | null;
  printAreaHeightPx?: number | null;
}): ListingArtworkLetterboxFill {
  if (listingArtworkLetterboxFillUsesWhite(params.itemArtworkLetterboxFill)) {
    return ListingArtworkLetterboxFill.white;
  }
  if (catalogItemNameSuggestsTransparentLetterbox(params.catalogItemName)) {
    return ListingArtworkLetterboxFill.transparent;
  }
  if (params.itemLargeListingArtwork) {
    return ListingArtworkLetterboxFill.white;
  }
  if (catalogItemNameSuggestsWhiteLetterbox(params.catalogItemName)) {
    return ListingArtworkLetterboxFill.white;
  }
  if (printAreaSuggestsWhiteLetterbox(params.printAreaWidthPx, params.printAreaHeightPx)) {
    return ListingArtworkLetterboxFill.white;
  }
  return ListingArtworkLetterboxFill.transparent;
}

export const ARTWORK_TRANSPARENT_LETTERBOX_PREVIEW_STYLE: CSSProperties = {
  backgroundColor: "#09090b",
  backgroundImage:
    "linear-gradient(45deg, rgb(39 39 42 / 0.95) 25%, transparent 25%), linear-gradient(-45deg, rgb(39 39 42 / 0.95) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(39 39 42 / 0.95) 75%), linear-gradient(-45deg, transparent 75%, rgb(39 39 42 / 0.95) 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
};

export const ARTWORK_WHITE_LETTERBOX_PREVIEW_STYLE: CSSProperties = {
  backgroundColor: "#ffffff",
};

export function listingArtworkLetterboxPreviewStyle(
  fill: ListingArtworkLetterboxFill | null | undefined,
): CSSProperties {
  return listingArtworkLetterboxFillUsesWhite(fill)
    ? ARTWORK_WHITE_LETTERBOX_PREVIEW_STYLE
    : ARTWORK_TRANSPARENT_LETTERBOX_PREVIEW_STYLE;
}
