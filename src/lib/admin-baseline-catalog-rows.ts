import { prisma } from "@/lib/prisma";
import type { AdminBaselineRow } from "@/lib/shop-baseline-catalog";
import type { ListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";
import type { CatalogArtworkSourceTierOverride } from "@/lib/listing-artwork-source-tier";

const adminCatalogSelect = {
  id: true,
  name: true,
  itemExampleListingUrl: true,
  itemMinPriceCents: true,
  itemGoodsServicesCostCents: true,
  itemImageRequirementLabel: true,
  itemPrintAreaWidthPx: true,
  itemPrintAreaHeightPx: true,
  itemMinArtworkDpi: true,
  itemArtworkLetterboxFill: true,
  itemLargeListingArtwork: true,
  itemArtworkSourceTierOverride: true,
} as const;

/** Admin baseline rows for shop dashboard catalog. */
export async function loadAdminBaselineCatalogRows(): Promise<AdminBaselineRow[]> {
  return prisma.adminCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminCatalogSelect,
  });
}

export type AdminCatalogItemArtworkPolicyRow = {
  name: string;
  itemImageRequirementLabel: string | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
  itemArtworkLetterboxFill: ListingArtworkLetterboxFill;
  itemLargeListingArtwork: boolean;
  itemArtworkSourceTierOverride: CatalogArtworkSourceTierOverride;
};

/** Print-area metadata for listing submit validation. */
export async function loadAdminCatalogItemArtworkPolicy(
  itemId: string,
): Promise<AdminCatalogItemArtworkPolicyRow | null> {
  return prisma.adminCatalogItem.findUnique({
    where: { id: itemId },
    select: {
      name: true,
      itemImageRequirementLabel: true,
      itemPrintAreaWidthPx: true,
      itemPrintAreaHeightPx: true,
      itemArtworkLetterboxFill: true,
      itemLargeListingArtwork: true,
      itemArtworkSourceTierOverride: true,
    },
  });
}

const adminListItemSelect = {
  id: true,
  name: true,
  storefrontDescription: true,
  itemPlatformProductId: true,
  itemExampleListingUrl: true,
  itemMinPriceCents: true,
  itemGoodsServicesCostCents: true,
  itemImageRequirementLabel: true,
  itemPrintAreaWidthPx: true,
  itemPrintAreaHeightPx: true,
  itemMinArtworkDpi: true,
  itemArtworkLetterboxFill: true,
  itemArtworkSourceTierOverride: true,
  catalogTags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

export type AdminListTabCatalogItem = Awaited<
  ReturnType<typeof loadAdminCatalogItemsForListTab>
>[number];

/** Admin → List tab rows. */
export async function loadAdminCatalogItemsForListTab() {
  return prisma.adminCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminListItemSelect,
  });
}
