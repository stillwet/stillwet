import {
  resolveListingArtworkLetterboxFill,
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";
import {
  resolveCatalogArtworkSourceTier,
  type CatalogArtworkSourceTier,
  type CatalogArtworkSourceTierOverride,
} from "@/lib/listing-artwork-source-tier";

/** Picker / form value: opaque token, not a storefront Product id until submit. */
const PICK_PREFIX = "ab|";

/** Admin catalog category tag (shop picker grouping). */
export type ShopSetupCatalogCategoryTag = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

/** One selectable catalog line (one admin baseline item). */
export type ShopSetupCatalogOption = {
  /** Baseline pick token (submitted as `productId`); server maps to a stub Product. */
  productId: string;
  label: string;
  minPriceCents: number;
  priceCents: number;
  exampleHref: string | null;
  /** Unit goods/services (COGS) from admin baseline — used for estimated shop profit at list price. */
  goodsServicesCostCents: number;
  /** Admin copy for print/DPI expectations. */
  imageRequirementLabel: string | null;
  /** When both print dimensions set, listing artwork uses fixed-aspect crop and exact export size (px). */
  printAreaWidthPx: number | null;
  printAreaHeightPx: number | null;
  /** When set with print area, crop must cover extra source pixels vs. 300 DPI template (see listing-artwork-print-area). */
  minArtworkDpi: number | null;
  /** Letterbox margin when artwork is zoomed out (transparent vs white print substrate). */
  artworkLetterboxFill: ListingArtworkLetterboxFill;
  /** Phone pic safe vs camera/vector guidance for creators. */
  artworkSourceTier: CatalogArtworkSourceTier;
};

/** One admin catalog item as a single selectable row. */
export type ShopSetupCatalogGroup = {
  itemId: string;
  itemName: string;
  /** Primary category for grouping (lowest tag sortOrder). */
  categoryTag: ShopSetupCatalogCategoryTag | null;
  option: Omit<ShopSetupCatalogOption, "label">;
};

/** Category subsection in the shop catalog picker. */
export type ShopSetupCatalogCategorySection = {
  categoryKey: string;
  categoryName: string;
  categorySortOrder: number;
  /** Smallest print canvas in this category (used for sort order). */
  minPrintAreaPx: number;
  groups: ShopSetupCatalogGroup[];
};

/** Flat list for resolving selection (price min, labels). */
export function flattenShopBaselineCatalogGroups(groups: ShopSetupCatalogGroup[]): ShopSetupCatalogOption[] {
  return groups.map((g) => ({
    productId: g.option.productId,
    label: g.itemName,
    minPriceCents: g.option.minPriceCents,
    priceCents: g.option.priceCents,
    exampleHref: g.option.exampleHref,
    goodsServicesCostCents: g.option.goodsServicesCostCents,
    imageRequirementLabel: g.option.imageRequirementLabel,
    printAreaWidthPx: g.option.printAreaWidthPx,
    printAreaHeightPx: g.option.printAreaHeightPx,
    minArtworkDpi: g.option.minArtworkDpi,
    artworkLetterboxFill: g.option.artworkLetterboxFill,
    artworkSourceTier: g.option.artworkSourceTier,
  }));
}

export type AdminBaselineRow = {
  id: string;
  name: string;
  /** @deprecated Legacy field; ignored for catalog display. */
  variants?: unknown;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
  itemGoodsServicesCostCents: number;
  itemImageRequirementLabel: string | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
  itemMinArtworkDpi: number | null;
  itemArtworkLetterboxFill: ListingArtworkLetterboxFill;
  itemLargeListingArtwork: boolean;
  itemArtworkSourceTierOverride: CatalogArtworkSourceTierOverride;
  catalogTags?: Array<{ tag: ShopSetupCatalogCategoryTag }>;
};

export type ParsedBaselinePick =
  | { mode: "item"; itemId: string }
  | { mode: "variant"; itemId: string; variantId: string }
  | { mode: "allVariants"; itemId: string };

export function encodeBaselinePickItem(itemId: string): string {
  return `${PICK_PREFIX}${itemId}|item`;
}

/** @deprecated Legacy encoded picks may still appear in the database. */
export function encodeBaselinePickVariant(itemId: string, variantId: string): string {
  return `${PICK_PREFIX}${itemId}|var|${variantId}`;
}

/** @deprecated Legacy encoded picks may still appear in the database. */
export function encodeBaselinePickAllVariants(itemId: string): string {
  return `${PICK_PREFIX}${itemId}|all`;
}

export function parseBaselinePick(raw: string): ParsedBaselinePick | null {
  const t = raw.trim();
  if (!t.startsWith(PICK_PREFIX)) return null;
  const parts = t.slice(PICK_PREFIX.length).split("|");
  if (parts.length === 2 && parts[1] === "item" && parts[0]) {
    return { mode: "item", itemId: parts[0] };
  }
  if (parts.length === 2 && parts[1] === "all" && parts[0]) {
    return { mode: "allVariants", itemId: parts[0] };
  }
  if (parts.length === 3 && parts[1] === "var" && parts[0] && parts[2]) {
    return { mode: "variant", itemId: parts[0], variantId: parts[2] };
  }
  return null;
}

function exampleHrefFromAdminUrl(raw: string | null | undefined): string | null {
  const u = String(raw ?? "").trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return u;
  return null;
}

const UNCategorizedCatalogCategoryKey = "__uncategorized__";
const UNCategorizedCatalogCategoryName = "Other";

/** Print canvas area in pixels (0 when unknown). */
export function shopBaselineCatalogPrintAreaPixels(
  printAreaWidthPx: number | null,
  printAreaHeightPx: number | null,
): number {
  if (printAreaWidthPx == null || printAreaHeightPx == null) return 0;
  if (printAreaWidthPx <= 0 || printAreaHeightPx <= 0) return 0;
  return printAreaWidthPx * printAreaHeightPx;
}

export function shopBaselineCatalogGroupPrintAreaPixels(group: ShopSetupCatalogGroup): number {
  return shopBaselineCatalogPrintAreaPixels(
    group.option.printAreaWidthPx,
    group.option.printAreaHeightPx,
  );
}

function compareShopBaselineCatalogGroupsByPrintAreaAsc(
  a: ShopSetupCatalogGroup,
  b: ShopSetupCatalogGroup,
): number {
  const areaDiff =
    shopBaselineCatalogGroupPrintAreaPixels(a) - shopBaselineCatalogGroupPrintAreaPixels(b);
  if (areaDiff !== 0) return areaDiff;
  return a.itemName.localeCompare(b.itemName, undefined, { sensitivity: "base" });
}

export function sortShopBaselineCatalogGroupsByPrintAreaAsc(
  groups: ShopSetupCatalogGroup[],
): ShopSetupCatalogGroup[] {
  return [...groups].sort(compareShopBaselineCatalogGroupsByPrintAreaAsc);
}

function primaryCategoryTagForItem(
  catalogTags: Array<{ tag: ShopSetupCatalogCategoryTag }> | undefined,
): ShopSetupCatalogCategoryTag | null {
  if (!catalogTags?.length) return null;
  const tags = catalogTags.map((ct) => ct.tag);
  tags.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  return tags[0] ?? null;
}

function categoryKeyForGroup(group: ShopSetupCatalogGroup): string {
  return group.categoryTag?.id ?? UNCategorizedCatalogCategoryKey;
}

function categoryNameForGroup(group: ShopSetupCatalogGroup): string {
  return group.categoryTag?.name ?? UNCategorizedCatalogCategoryName;
}

function categorySortOrderForGroup(group: ShopSetupCatalogGroup): number {
  return group.categoryTag?.sortOrder ?? Number.MAX_SAFE_INTEGER;
}

/** Group catalog rows by category; categories ordered by smallest print canvas in each. */
export function organizeShopBaselineCatalogByCategory(
  groups: ShopSetupCatalogGroup[],
): ShopSetupCatalogCategorySection[] {
  const byCategory = new Map<string, ShopSetupCatalogGroup[]>();
  for (const group of groups) {
    const key = categoryKeyForGroup(group);
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(group);
    else byCategory.set(key, [group]);
  }

  const sections: ShopSetupCatalogCategorySection[] = [];
  for (const [categoryKey, categoryGroups] of byCategory) {
    const sortedGroups = sortShopBaselineCatalogGroupsByPrintAreaAsc(categoryGroups);
    const sample = sortedGroups[0];
    sections.push({
      categoryKey,
      categoryName: categoryNameForGroup(sample),
      categorySortOrder: categorySortOrderForGroup(sample),
      minPrintAreaPx: shopBaselineCatalogGroupPrintAreaPixels(sortedGroups[0]),
      groups: sortedGroups,
    });
  }

  sections.sort((a, b) => {
    const aOther = a.categoryKey === UNCategorizedCatalogCategoryKey;
    const bOther = b.categoryKey === UNCategorizedCatalogCategoryKey;
    if (aOther && !bOther) return 1;
    if (!aOther && bOther) return -1;
    const byCanvas = a.minPrintAreaPx - b.minPrintAreaPx;
    if (byCanvas !== 0) return byCanvas;
    const byTagOrder = a.categorySortOrder - b.categorySortOrder;
    if (byTagOrder !== 0) return byTagOrder;
    return a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: "base" });
  });

  return sections;
}

/**
 * Shop “Add to store” options: one row per admin catalog item (item-level pricing only).
 */
export function buildShopBaselineCatalogGroups(items: AdminBaselineRow[]): ShopSetupCatalogGroup[] {
  const out: ShopSetupCatalogGroup[] = [];
  for (const item of items) {
    const categoryTag = primaryCategoryTagForItem(item.catalogTags);
    out.push({
      itemId: item.id,
      itemName: item.name,
      categoryTag,
      option: {
        productId: encodeBaselinePickItem(item.id),
        minPriceCents: Math.max(0, item.itemMinPriceCents),
        priceCents: Math.max(0, item.itemMinPriceCents),
        exampleHref: exampleHrefFromAdminUrl(item.itemExampleListingUrl),
        goodsServicesCostCents: Math.max(0, item.itemGoodsServicesCostCents),
        imageRequirementLabel: item.itemImageRequirementLabel?.trim() || null,
        printAreaWidthPx:
          item.itemPrintAreaWidthPx != null &&
          item.itemPrintAreaHeightPx != null &&
          item.itemPrintAreaWidthPx > 0 &&
          item.itemPrintAreaHeightPx > 0
            ? item.itemPrintAreaWidthPx
            : null,
        printAreaHeightPx:
          item.itemPrintAreaWidthPx != null &&
          item.itemPrintAreaHeightPx != null &&
          item.itemPrintAreaWidthPx > 0 &&
          item.itemPrintAreaHeightPx > 0
            ? item.itemPrintAreaHeightPx
            : null,
        minArtworkDpi:
          item.itemMinArtworkDpi != null && item.itemMinArtworkDpi > 0 ? item.itemMinArtworkDpi : null,
        artworkLetterboxFill: resolveListingArtworkLetterboxFill({
          itemArtworkLetterboxFill: item.itemArtworkLetterboxFill,
          itemLargeListingArtwork: item.itemLargeListingArtwork,
          catalogItemName: item.name,
          printAreaWidthPx: item.itemPrintAreaWidthPx,
          printAreaHeightPx: item.itemPrintAreaHeightPx,
        }),
        artworkSourceTier: resolveCatalogArtworkSourceTier({
          itemArtworkSourceTierOverride: item.itemArtworkSourceTierOverride,
          printAreaWidthPx: item.itemPrintAreaWidthPx,
          printAreaHeightPx: item.itemPrintAreaHeightPx,
        }),
      },
    });
  }
  return out;
}

/** Catalog groups partitioned for the shop listing picker (phone-safe first). */
export function partitionShopBaselineCatalogGroups(groups: ShopSetupCatalogGroup[]): {
  phonePicSafe: ShopSetupCatalogGroup[];
  cameraOrVectorOnly: ShopSetupCatalogGroup[];
} {
  const phonePicSafe: ShopSetupCatalogGroup[] = [];
  const cameraOrVectorOnly: ShopSetupCatalogGroup[] = [];
  for (const g of groups) {
    if (g.option.artworkSourceTier === "phone_pic_safe") {
      phonePicSafe.push(g);
    } else {
      cameraOrVectorOnly.push(g);
    }
  }
  return {
    phonePicSafe: sortShopBaselineCatalogGroupsByPrintAreaAsc(phonePicSafe),
    cameraOrVectorOnly: sortShopBaselineCatalogGroupsByPrintAreaAsc(cameraOrVectorOnly),
  };
}
