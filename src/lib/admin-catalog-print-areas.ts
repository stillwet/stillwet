/**
 * Print-area templates for admin catalog items (synced from production).
 * Used to regression-test upload/crop policy — update when Admin → List print sizes change.
 */
/** Printify combined front+back file sizes (shop upload uses per-side via normalizePillowCatalogArtworkSurfaces). */
export const ADMIN_CATALOG_PRINT_AREA_FIXTURES: ReadonlyArray<{
  name: string;
  printWidthPx: number;
  printHeightPx: number;
}> = [
  { name: "Body Pillow", printWidthPx: 8325, printHeightPx: 3225 },
  { name: 'Canvas Print (12")', printWidthPx: 3600, printHeightPx: 2700 },
  { name: "Gaming Mousepad", printWidthPx: 3071, printHeightPx: 2598 },
  { name: 'Square Pillow (14"x14")', printWidthPx: 4650, printHeightPx: 2325 },
  { name: 'Canvas Print (24"x16")', printWidthPx: 7200, printHeightPx: 4800 },
  { name: 'Velveteen Microfiber Blanket (40"x30")', printWidthPx: 6400, printHeightPx: 8400 },
  { name: "Desk Mat", printWidthPx: 4843, printHeightPx: 2480 },
  { name: "Poker / Playing Cards", printWidthPx: 775, printHeightPx: 1125 },
  { name: "Ceramic Mug (white, 11 oz)", printWidthPx: 2475, printHeightPx: 1155 },
  { name: "Ceramic Mug (white, 15 oz)", printWidthPx: 2475, printHeightPx: 1275 },
  { name: "Ceramic Mug (Black, 11 oz)", printWidthPx: 2327, printHeightPx: 1086 },
  { name: "Ceramic Mug (Black, 15 oz)", printWidthPx: 2327, printHeightPx: 1086 },
  { name: 'Gloss Poster (16.5" x 11.7")', printWidthPx: 4200, printHeightPx: 2970 },
  { name: 'Gloss Poster (23.4" x 16.5")', printWidthPx: 5940, printHeightPx: 4200 },
  { name: 'Hand Towel (18" × 30")', printWidthPx: 3000, printHeightPx: 4800 },
  { name: "Keychain (Metal, Rectangle)", printWidthPx: 274, printHeightPx: 394 },
] as const;
