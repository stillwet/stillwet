import { AdminCatalogItemArtworkSourceTierOverride, ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import {
  catalogArtworkTemplatePresetFromJson,
  catalogCanvasPresentationPresetIdFromPresentation,
  parseCatalogCanvasPresentation,
} from "@/lib/admin-catalog-canvas-presentation";

/** True when artwork / crop-preview settings differ from defaults — expand advanced fields on edit. */
export function adminCatalogItemHasAdvancedArtworkSettings(input: {
  itemImageRequirementLabel: string | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
  itemMinArtworkDpi: number | null;
  itemArtworkLetterboxFill: ListingArtworkLetterboxFill;
  itemArtworkSourceTierOverride: AdminCatalogItemArtworkSourceTierOverride;
  itemCanvasPresentation: unknown;
  itemArtworkTemplate: unknown;
}): boolean {
  if (input.itemImageRequirementLabel?.trim()) return true;
  if (input.itemPrintAreaWidthPx != null && input.itemPrintAreaWidthPx > 0) return true;
  if (input.itemPrintAreaHeightPx != null && input.itemPrintAreaHeightPx > 0) return true;
  if (input.itemMinArtworkDpi != null && input.itemMinArtworkDpi > 0) return true;
  if (input.itemArtworkLetterboxFill !== ListingArtworkLetterboxFill.transparent) return true;
  if (input.itemArtworkSourceTierOverride !== AdminCatalogItemArtworkSourceTierOverride.auto) {
    return true;
  }
  const canvasPreset = catalogCanvasPresentationPresetIdFromPresentation(
    parseCatalogCanvasPresentation(input.itemCanvasPresentation),
  );
  if (canvasPreset !== "flat") return true;
  if (catalogArtworkTemplatePresetFromJson(input.itemArtworkTemplate) !== "none") return true;
  return false;
}

/** True when a picture URL is set — expand Pictures on edit. */
export function adminCatalogItemHasPictureSettings(input: {
  itemExampleListingUrl: string | null;
  itemSizeExampleImageUrl?: string | null;
}): boolean {
  return Boolean(input.itemExampleListingUrl?.trim() || input.itemSizeExampleImageUrl?.trim());
}
