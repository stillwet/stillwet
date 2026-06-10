import { prisma } from "@/lib/prisma";
import type { AdminBaselineRow } from "@/lib/shop-baseline-catalog";
import type { ListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";
import type { CatalogArtworkSourceTierOverride } from "@/lib/listing-artwork-source-tier";

const adminCatalogSelect = {
  id: true,
  name: true,
  itemExampleListingUrl: true,
  itemSizeExampleImageUrl: true,
  itemMinPriceCents: true,
  itemGoodsServicesCostCents: true,
  itemProductionFeeCents: true,
  itemImageRequirementLabel: true,
  itemPrintAreaWidthPx: true,
  itemPrintAreaHeightPx: true,
  itemMinArtworkDpi: true,
  itemArtworkLetterboxFill: true,
  itemLargeListingArtwork: true,
  itemArtworkSourceTierOverride: true,
  itemCanvasPresentation: true,
  itemArtworkTemplate: true,
  catalogTags: {
    select: {
      tag: { select: { id: true, name: true, slug: true, sortOrder: true } },
    },
  },
} as const;

/** Admin baseline rows for shop dashboard catalog (standard items only). */
export async function loadAdminBaselineCatalogRows(): Promise<AdminBaselineRow[]> {
  return prisma.adminCatalogItem.findMany({
    where: { itemSecretMenuOnly: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminCatalogSelect,
  });
}

/** Secret-menu catalog rows for shops with admin-granted access. */
export async function loadAdminSecretMenuCatalogRows(): Promise<AdminBaselineRow[]> {
  return prisma.adminCatalogItem.findMany({
    where: { itemSecretMenuOnly: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminCatalogSelect,
  });
}

export type AdminCatalogItemArtworkPolicyRow = {
  name: string;
  itemImageRequirementLabel: string | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
  itemMinArtworkDpi: number | null;
  itemArtworkLetterboxFill: ListingArtworkLetterboxFill;
  itemLargeListingArtwork: boolean;
  itemArtworkSourceTierOverride: CatalogArtworkSourceTierOverride;
  itemCanvasPresentation: unknown;
  itemArtworkTemplate: unknown;
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
      itemMinArtworkDpi: true,
      itemArtworkLetterboxFill: true,
      itemLargeListingArtwork: true,
      itemArtworkSourceTierOverride: true,
      itemCanvasPresentation: true,
      itemArtworkTemplate: true,
    },
  });
}

const adminListItemSelect = {
  id: true,
  name: true,
  storefrontDescription: true,
  itemPlatformProductId: true,
  itemExampleListingUrl: true,
  itemSizeExampleImageUrl: true,
  itemMinPriceCents: true,
  itemGoodsServicesCostCents: true,
  itemProductionFeeCents: true,
  itemImageRequirementLabel: true,
  itemPrintAreaWidthPx: true,
  itemPrintAreaHeightPx: true,
  itemMinArtworkDpi: true,
  itemArtworkLetterboxFill: true,
  itemArtworkSourceTierOverride: true,
  itemCanvasPresentation: true,
  itemArtworkTemplate: true,
  catalogTags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

export type AdminListTabCatalogItem = Awaited<
  ReturnType<typeof loadAdminCatalogItemsForListTab>
>[number];

function compareAdminCatalogItemNamesAsc(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Admin → List tab rows (standard or secret menu), A→Z by item name. */
export async function loadAdminCatalogItemsForListTab(options?: { secretMenuOnly?: boolean }) {
  const secretMenuOnly = options?.secretMenuOnly ?? false;
  const rows = await prisma.adminCatalogItem.findMany({
    where: { itemSecretMenuOnly: secretMenuOnly },
    select: adminListItemSelect,
  });
  return rows.sort(compareAdminCatalogItemNamesAsc);
}
