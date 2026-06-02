import { prisma } from "@/lib/prisma";
import type { AdminBaselineRow } from "@/lib/shop-baseline-catalog";

const adminCatalogSelectBase = {
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

const adminCatalogSelectWithLarge = {
  ...adminCatalogSelectBase,
  itemLargeListingArtwork: true,
} as const;

export function isMissingLargeListingArtworkColumn(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = "code" in e ? String((e as { code?: string }).code) : "";
  const msg = e instanceof Error ? e.message : String(e);
  return (
    code === "P2022" ||
    (/itemLargeListingArtwork/i.test(msg) && /does not exist|Unknown column|column/i.test(msg))
  );
}

function mapAdminCatalogRow(
  row: {
    id: string;
    name: string;
    itemExampleListingUrl: string | null;
    itemMinPriceCents: number;
    itemGoodsServicesCostCents: number;
    itemImageRequirementLabel: string | null;
    itemPrintAreaWidthPx: number | null;
    itemPrintAreaHeightPx: number | null;
    itemMinArtworkDpi: number | null;
    itemLargeListingArtwork?: boolean;
  },
): AdminBaselineRow {
  return {
    id: row.id,
    name: row.name,
    itemExampleListingUrl: row.itemExampleListingUrl,
    itemMinPriceCents: row.itemMinPriceCents,
    itemGoodsServicesCostCents: row.itemGoodsServicesCostCents,
    itemImageRequirementLabel: row.itemImageRequirementLabel,
    itemPrintAreaWidthPx: row.itemPrintAreaWidthPx,
    itemPrintAreaHeightPx: row.itemPrintAreaHeightPx,
    itemMinArtworkDpi: row.itemMinArtworkDpi,
    itemLargeListingArtwork: row.itemLargeListingArtwork ?? false,
  };
}

/** Admin baseline rows for shop dashboard catalog (tolerates pre-migration DB without large-artwork column). */
export async function loadAdminBaselineCatalogRows(): Promise<AdminBaselineRow[]> {
  try {
    const rows = await prisma.adminCatalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminCatalogSelectWithLarge,
    });
    return rows.map(mapAdminCatalogRow);
  } catch (e) {
    if (!isMissingLargeListingArtworkColumn(e)) throw e;
    console.warn(
      "[admin catalog] itemLargeListingArtwork column missing — using 15 MB artwork limit until migration 20260603120000_admin_catalog_large_listing_artwork is applied",
    );
    const rows = await prisma.adminCatalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminCatalogSelectBase,
    });
    return rows.map(mapAdminCatalogRow);
  }
}

export type AdminCatalogItemArtworkPolicyRow = {
  itemLargeListingArtwork: boolean;
  itemImageRequirementLabel: string | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
};

/** Per-item artwork limits for listing submit (same migration fallback as catalog load). */
export async function loadAdminCatalogItemArtworkPolicy(
  itemId: string,
): Promise<AdminCatalogItemArtworkPolicyRow | null> {
  try {
    const row = await prisma.adminCatalogItem.findUnique({
      where: { id: itemId },
      select: {
        itemLargeListingArtwork: true,
        itemImageRequirementLabel: true,
        itemPrintAreaWidthPx: true,
        itemPrintAreaHeightPx: true,
      },
    });
    if (!row) return null;
    return {
      itemLargeListingArtwork: row.itemLargeListingArtwork ?? false,
      itemImageRequirementLabel: row.itemImageRequirementLabel,
      itemPrintAreaWidthPx: row.itemPrintAreaWidthPx,
      itemPrintAreaHeightPx: row.itemPrintAreaHeightPx,
    };
  } catch (e) {
    if (!isMissingLargeListingArtworkColumn(e)) throw e;
    const row = await prisma.adminCatalogItem.findUnique({
      where: { id: itemId },
      select: {
        itemImageRequirementLabel: true,
        itemPrintAreaWidthPx: true,
        itemPrintAreaHeightPx: true,
      },
    });
    if (!row) return null;
    return {
      itemLargeListingArtwork: false,
      itemImageRequirementLabel: row.itemImageRequirementLabel,
      itemPrintAreaWidthPx: row.itemPrintAreaWidthPx,
      itemPrintAreaHeightPx: row.itemPrintAreaHeightPx,
    };
  }
}

const adminListItemSelectBase = {
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

const adminListItemSelectWithLarge = {
  ...adminListItemSelectBase,
  itemLargeListingArtwork: true,
} as const;

export type AdminListTabCatalogItem = Awaited<
  ReturnType<typeof loadAdminCatalogItemsForListTab>
>[number];

/** Admin → List tab rows (tolerates DB before large-artwork migration). */
export async function loadAdminCatalogItemsForListTab() {
  try {
    const rows = await prisma.adminCatalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminListItemSelectWithLarge,
    });
    return rows.map((item) => ({
      ...item,
      itemLargeListingArtwork: item.itemLargeListingArtwork ?? false,
    }));
  } catch (e) {
    if (!isMissingLargeListingArtworkColumn(e)) throw e;
    console.warn(
      "[admin catalog] itemLargeListingArtwork column missing — admin list uses 15 MB default until migration 20260603120000_admin_catalog_large_listing_artwork is applied",
    );
    const rows = await prisma.adminCatalogItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: adminListItemSelectBase,
    });
    return rows.map((item) => ({ ...item, itemLargeListingArtwork: false }));
  }
}
