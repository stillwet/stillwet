/** Corner radius as a fraction of the shorter crop edge (approx. standard poker card rounding). */
export const ROUNDED_CORNER_CROP_RADIUS_FRACTION = 0.05;

/** @deprecated Use {@link ROUNDED_CORNER_CROP_RADIUS_FRACTION}. */
export const PLAYING_CARD_CORNER_RADIUS_FRACTION = ROUNDED_CORNER_CROP_RADIUS_FRACTION;

/** Corner wedge fill — 50% black over the crop preview (visual guide only). */
export const ROUNDED_CORNER_CROP_OVERLAY_FILL_OPACITY = 0.5;

export const ROUNDED_CORNER_CROP_OVERLAY_FILL = `rgba(0, 0, 0, ${ROUNDED_CORNER_CROP_OVERLAY_FILL_OPACITY})`;

/**
 * @deprecated Rounded-corner guide is rendered by ListingArtworkRoundedCornerCropGuideOverlay.
 */
export const LISTING_ARTWORK_CROP_AREA_ROUNDED_GUIDE_CLASS = "listing-artwork-crop-area-rounded-guide";

/** @deprecated Use {@link ROUNDED_CORNER_CROP_OVERLAY_FILL}. */
export const PLAYING_CARD_CORNER_OVERLAY_FILL = ROUNDED_CORNER_CROP_OVERLAY_FILL;

export function roundedCornerCropRadiusPx(cropWidth: number, cropHeight: number): number {
  if (!(cropWidth > 0) || !(cropHeight > 0)) return 0;
  return Math.min(cropWidth, cropHeight) * ROUNDED_CORNER_CROP_RADIUS_FRACTION;
}

/**
 * SVG path for corner wedges only (outer rect minus inner rounded rect).
 * Uses fill-rule="evenodd" — no SVG mask (masks fail when portaled / in some engines).
 */
export function roundedCornerCropGuideWedgePathD(
  width: number,
  height: number,
  radius: number,
): string {
  const w = width;
  const h = height;
  const r = Math.min(Math.max(radius, 0), w / 2, h / 2);
  const outer = `M 0 0 H ${w} V ${h} H 0 Z`;
  const inner = [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
  return `${outer} ${inner}`;
}

/** @deprecated Use {@link roundedCornerCropRadiusPx}. */
export function playingCardCornerRadiusPx(cropWidth: number, cropHeight: number): number {
  return roundedCornerCropRadiusPx(cropWidth, cropHeight);
}

function normalizedCatalogName(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Playing-card deck print templates (775×1125 etc.). */
export function catalogItemIsPlayingCard(params: {
  catalogItemName?: string | null;
  categoryTagSlug?: string | null;
}): boolean {
  const slug = String(params.categoryTagSlug ?? "").trim().toLowerCase();
  if (
    slug.includes("playing-card") ||
    slug.includes("playing-cards") ||
    slug === "poker" ||
    slug.includes("poker-card")
  ) {
    return true;
  }
  const n = normalizedCatalogName(params.catalogItemName);
  if (!n) return false;
  if (/\bplaying cards?\b/.test(n)) return true;
  if (/\bpoker\b/.test(n) && /\bcards?\b/.test(n)) return true;
  return false;
}

/** Gaming / desk mousepad print templates. */
export function catalogItemIsMousepad(params: {
  catalogItemName?: string | null;
  categoryTagSlug?: string | null;
}): boolean {
  const slug = String(params.categoryTagSlug ?? "").trim().toLowerCase();
  if (slug === "mousepad" || slug.includes("mousepad") || slug.includes("mouse-pad")) return true;
  const n = normalizedCatalogName(params.catalogItemName);
  if (!n) return false;
  if (/\bdesk mats?\b/.test(n)) return false;
  return /\bmousepads?\b/.test(n) || /\bmouse pads?\b/.test(n);
}

/** Large desk mat print templates (rounded physical corners). */
export function catalogItemIsDeskMat(params: {
  catalogItemName?: string | null;
  categoryTagSlug?: string | null;
}): boolean {
  const slug = String(params.categoryTagSlug ?? "").trim().toLowerCase();
  if (slug.includes("desk-mat") || slug.includes("deskmat")) return true;
  const n = normalizedCatalogName(params.catalogItemName);
  if (!n) return false;
  if (/\bdeskmat(s)?\b/.test(n)) return true;
  if (/\bdesk mats?\b/.test(n)) return true;
  if (/\bdeskpads?\b/.test(n) || /\bdesk pads?\b/.test(n)) return true;
  if (/\bdesk\b/.test(n) && /\bmat\b/.test(n) && !/\bmouse/.test(n)) return true;
  // Grouped under a generic "desk" tag in admin catalog.
  if (slug.includes("desk") && /\b(mat|pad)s?\b/.test(n) && !/\bmouse/.test(n)) return true;
  return false;
}

/** Known Printify print templates that use the rounded-corner crop guide. */
export const ROUNDED_CORNER_CROP_GUIDE_PRINT_AREAS: ReadonlyArray<{
  printAreaWidthPx: number;
  printAreaHeightPx: number;
}> = [
  { printAreaWidthPx: 775, printAreaHeightPx: 1125 },
  { printAreaWidthPx: 3071, printAreaHeightPx: 2598 },
  { printAreaWidthPx: 4843, printAreaHeightPx: 2480 },
];

/** Print aspects for templates above (playing cards, mousepads, desk mats). */
const ROUNDED_CORNER_CROP_GUIDE_ASPECTS: readonly number[] = ROUNDED_CORNER_CROP_GUIDE_PRINT_AREAS.map(
  (area) => area.printAreaWidthPx / area.printAreaHeightPx,
);

/** Match admin print sizes that drift slightly from Printify templates. */
const ROUNDED_CORNER_CROP_GUIDE_ASPECT_TOLERANCE = 0.02;

function printAspectMatchesRoundedCornerGuide(aspect: number): boolean {
  if (!(aspect > 0)) return false;
  const inverse = 1 / aspect;
  return ROUNDED_CORNER_CROP_GUIDE_ASPECTS.some((templateAspect) => {
    const delta = Math.min(
      Math.abs(aspect - templateAspect),
      Math.abs(inverse - templateAspect),
    );
    return delta / templateAspect <= ROUNDED_CORNER_CROP_GUIDE_ASPECT_TOLERANCE;
  });
}

export function catalogPrintAreaUsesRoundedCornerCropGuide(
  printAreaWidthPx: number | null | undefined,
  printAreaHeightPx: number | null | undefined,
): boolean {
  const w = printAreaWidthPx ?? 0;
  const h = printAreaHeightPx ?? 0;
  if (!(w > 0) || !(h > 0)) return false;
  if (
    ROUNDED_CORNER_CROP_GUIDE_PRINT_AREAS.some(
      (area) =>
        (area.printAreaWidthPx === w && area.printAreaHeightPx === h) ||
        (area.printAreaWidthPx === h && area.printAreaHeightPx === w),
    )
  ) {
    return true;
  }
  return printAspectMatchesRoundedCornerGuide(w / h);
}

/** Playing cards, mousepads, desk mats — rounded printable faces. */
export function catalogItemUsesRoundedCornerCropGuide(params: {
  catalogItemName?: string | null;
  categoryTagSlug?: string | null;
  printAreaWidthPx?: number | null;
  printAreaHeightPx?: number | null;
}): boolean {
  if (
    catalogPrintAreaUsesRoundedCornerCropGuide(
      params.printAreaWidthPx,
      params.printAreaHeightPx,
    )
  ) {
    return true;
  }
  return (
    catalogItemIsPlayingCard(params) ||
    catalogItemIsMousepad(params) ||
    catalogItemIsDeskMat(params)
  );
}

/** Single gate for crop UI — use in panel + both crop dialogs. */
export function listingArtworkCropShowsRoundedCornerGuide(params: {
  showRoundedCornerCropGuide?: boolean;
  catalogItemName?: string | null;
  categoryTagSlug?: string | null;
  printWidthPx: number;
  printHeightPx: number;
}): boolean {
  if (params.showRoundedCornerCropGuide) return true;
  return catalogItemUsesRoundedCornerCropGuide({
    catalogItemName: params.catalogItemName,
    categoryTagSlug: params.categoryTagSlug,
    printAreaWidthPx: params.printWidthPx,
    printAreaHeightPx: params.printHeightPx,
  });
}
