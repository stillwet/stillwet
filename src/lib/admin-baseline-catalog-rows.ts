import { prisma } from "@/lib/prisma";
import type { AdminBaselineRow } from "@/lib/shop-baseline-catalog";

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
} as const;

/** Admin baseline rows for shop dashboard catalog. */
export async function loadAdminBaselineCatalogRows(): Promise<AdminBaselineRow[]> {
  return prisma.adminCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminCatalogSelect,
  });
}

export type AdminCatalogItemArtworkPolicyRow = {
  itemImageRequirementLabel: string | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
};

/** Print-area metadata for listing submit validation. */
export async function loadAdminCatalogItemArtworkPolicy(
  itemId: string,
): Promise<AdminCatalogItemArtworkPolicyRow | null> {
  return prisma.adminCatalogItem.findUnique({
    where: { id: itemId },
    select: {
      itemImageRequirementLabel: true,
      itemPrintAreaWidthPx: true,
      itemPrintAreaHeightPx: true,
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
