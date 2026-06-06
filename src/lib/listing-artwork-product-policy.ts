import { FulfillmentType } from "@/generated/prisma/enums";
import { loadAdminCatalogItemArtworkPolicy } from "@/lib/admin-baseline-catalog-rows";
import { resolveListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";
import {
  listingArtworkDecodeMaxPixelsForPrintArea,
  listingArtworkSourceMaxBytesForPrintArea,
} from "@/lib/listing-request-artwork-limits";
import {
  resolveCatalogArtworkSourceTier,
  type CatalogArtworkSourceTier,
} from "@/lib/listing-artwork-source-tier";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import { prisma } from "@/lib/prisma";

export type ListingArtworkProductPolicy = {
  printAreaW: number | null;
  printAreaH: number | null;
  catalogImageRequirementLabel: string | null;
  letterboxFill: ReturnType<typeof resolveListingArtworkLetterboxFill> | null;
  artworkSourceTier: CatalogArtworkSourceTier;
  maxDecodePixels: number;
  maxSourceBytes: number;
};

/** Catalog print policy + artwork source tier for upload/bake validation. */
export async function resolveListingArtworkProductPolicy(
  productIdRaw: string,
): Promise<ListingArtworkProductPolicy | null> {
  const pickRaw = productIdRaw.trim();
  const baselinePick = parseBaselinePick(pickRaw);

  let printAreaW: number | null = null;
  let printAreaH: number | null = null;
  let catalogImageRequirementLabel: string | null = null;
  let letterboxFill = null as ReturnType<typeof resolveListingArtworkLetterboxFill> | null;
  let artworkSourceTier: CatalogArtworkSourceTier = "phone_pic_safe";

  if (baselinePick) {
    const adminItem = await loadAdminCatalogItemArtworkPolicy(baselinePick.itemId);
    if (!adminItem) return null;
    catalogImageRequirementLabel = adminItem.itemImageRequirementLabel?.trim() || null;
    const pw = adminItem.itemPrintAreaWidthPx ?? null;
    const ph = adminItem.itemPrintAreaHeightPx ?? null;
    if (pw != null && ph != null && pw > 0 && ph > 0) {
      printAreaW = pw;
      printAreaH = ph;
    }
    letterboxFill = resolveListingArtworkLetterboxFill({
      itemArtworkLetterboxFill: adminItem.itemArtworkLetterboxFill,
      itemLargeListingArtwork: adminItem.itemLargeListingArtwork,
      catalogItemName: adminItem.name,
      printAreaWidthPx: printAreaW,
      printAreaHeightPx: printAreaH,
    });
    artworkSourceTier = resolveCatalogArtworkSourceTier({
      itemArtworkSourceTierOverride: adminItem.itemArtworkSourceTierOverride,
      printAreaWidthPx: printAreaW,
      printAreaHeightPx: printAreaH,
    });
    return {
      printAreaW,
      printAreaH,
      catalogImageRequirementLabel,
      letterboxFill,
      artworkSourceTier,
      maxDecodePixels: listingArtworkDecodeMaxPixelsForPrintArea(
        printAreaW,
        printAreaH,
        artworkSourceTier,
        adminItem.name,
      ),
      maxSourceBytes: listingArtworkSourceMaxBytesForPrintArea(printAreaW, printAreaH, adminItem.name),
    };
  }

  const product = await prisma.product.findFirst({
    where: {
      id: pickRaw,
      active: true,
      fulfillmentType: FulfillmentType.printify,
    },
    select: { id: true },
  });
  if (!product) return null;

  return {
    printAreaW,
    printAreaH,
    catalogImageRequirementLabel,
    letterboxFill,
    artworkSourceTier,
    maxDecodePixels: listingArtworkDecodeMaxPixelsForPrintArea(
      printAreaW,
      printAreaH,
      artworkSourceTier,
    ),
    maxSourceBytes: listingArtworkSourceMaxBytesForPrintArea(printAreaW, printAreaH),
  };
}
