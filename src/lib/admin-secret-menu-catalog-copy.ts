import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  adminCatalogItemReferenceImageObjectKey,
  adminCatalogItemSizeExampleImageObjectKey,
  catalogItemReferenceImageUrlToObjectKey,
  catalogItemSizeExampleImageUrlToObjectKey,
  copyR2ObjectWithinBucket,
  publicHttpsUrlForR2ObjectKey,
} from "@/lib/r2-upload";

export type ImportStandardCatalogToSecretMenuResult =
  | { ok: true; copiedCount: number; skippedAlreadyPresentCount: number }
  | { ok: false; error: string };

export type AdminCatalogSecretMenuImportOption = {
  id: string;
  name: string;
  alreadyImported: boolean;
};

type StandardCatalogRow = Awaited<ReturnType<typeof loadStandardCatalogRowsByIds>>[number];

/** Match secret-menu copies to Admin list rows by trimmed name (case-insensitive). */
export function adminCatalogItemNameImportKey(name: string): string {
  return name.trim().toLowerCase();
}

async function loadStandardCatalogRowsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.adminCatalogItem.findMany({
    where: { id: { in: ids }, itemSecretMenuOnly: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { catalogTags: { select: { tagId: true } } },
  });
}

async function loadSecretMenuNameImportKeys(): Promise<Set<string>> {
  const rows = await prisma.adminCatalogItem.findMany({
    where: { itemSecretMenuOnly: true },
    select: { name: true },
  });
  return new Set(rows.map((r) => adminCatalogItemNameImportKey(r.name)));
}

export async function loadAdminCatalogSecretMenuImportOptions(): Promise<
  AdminCatalogSecretMenuImportOption[]
> {
  const [standardRows, secretNameKeys] = await Promise.all([
    prisma.adminCatalogItem.findMany({
      where: { itemSecretMenuOnly: false },
      select: { id: true, name: true },
    }),
    loadSecretMenuNameImportKeys(),
  ]);

  return standardRows
    .map((row) => ({
      id: row.id,
      name: row.name,
      alreadyImported: secretNameKeys.has(adminCatalogItemNameImportKey(row.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function catalogItemCreateDataFromStandardRow(
  source: StandardCatalogRow,
  sortOrder: number,
): Prisma.AdminCatalogItemCreateInput {
  return {
    name: source.name,
    sortOrder,
    storefrontDescription: source.storefrontDescription,
    variants: source.variants as Prisma.InputJsonValue,
    itemPlatformProduct: source.itemPlatformProductId
      ? { connect: { id: source.itemPlatformProductId } }
      : undefined,
    itemExampleListingUrl: source.itemExampleListingUrl,
    itemSizeExampleImageUrl: source.itemSizeExampleImageUrl,
    itemMinPriceCents: source.itemMinPriceCents,
    itemGoodsServicesCostCents: source.itemGoodsServicesCostCents,
    itemImageRequirementLabel: source.itemImageRequirementLabel,
    itemMinArtworkLongEdgePx: source.itemMinArtworkLongEdgePx,
    itemPrintAreaWidthPx: source.itemPrintAreaWidthPx,
    itemPrintAreaHeightPx: source.itemPrintAreaHeightPx,
    itemMinArtworkDpi: source.itemMinArtworkDpi,
    itemLargeListingArtwork: source.itemLargeListingArtwork,
    itemArtworkLetterboxFill: source.itemArtworkLetterboxFill,
    itemArtworkSourceTierOverride: source.itemArtworkSourceTierOverride,
    itemCanvasPresentation:
      source.itemCanvasPresentation === null
        ? PrismaNamespace.JsonNull
        : (source.itemCanvasPresentation as Prisma.InputJsonValue),
    itemArtworkTemplate:
      source.itemArtworkTemplate === null
        ? PrismaNamespace.JsonNull
        : (source.itemArtworkTemplate as Prisma.InputJsonValue),
    itemSecretMenuOnly: true,
    catalogTags: {
      create: source.catalogTags.map((t) => ({ tagId: t.tagId })),
    },
  };
}

async function copyOwnedCatalogImageUrl(
  publicUrl: string | null,
  sourceCatalogItemId: string,
  destCatalogItemId: string,
  urlToKey: (url: string, catalogItemId: string) => string | null,
  destObjectKey: (catalogItemId: string) => string,
): Promise<string | null> {
  if (!publicUrl?.trim()) return null;

  const sourceKey = urlToKey(publicUrl, sourceCatalogItemId);
  if (!sourceKey) return publicUrl;

  const destKey = destObjectKey(destCatalogItemId);
  const copied = await copyR2ObjectWithinBucket(sourceKey, destKey);
  if (!copied) return publicUrl;

  try {
    return publicHttpsUrlForR2ObjectKey(destKey);
  } catch {
    return publicUrl;
  }
}

async function copyCatalogItemImagesFromStandardRow(
  source: StandardCatalogRow,
  destCatalogItemId: string,
): Promise<{ itemExampleListingUrl: string | null; itemSizeExampleImageUrl: string | null }> {
  const [itemExampleListingUrl, itemSizeExampleImageUrl] = await Promise.all([
    copyOwnedCatalogImageUrl(
      source.itemExampleListingUrl,
      source.id,
      destCatalogItemId,
      catalogItemReferenceImageUrlToObjectKey,
      adminCatalogItemReferenceImageObjectKey,
    ),
    copyOwnedCatalogImageUrl(
      source.itemSizeExampleImageUrl,
      source.id,
      destCatalogItemId,
      catalogItemSizeExampleImageUrlToObjectKey,
      adminCatalogItemSizeExampleImageObjectKey,
    ),
  ]);
  return { itemExampleListingUrl, itemSizeExampleImageUrl };
}

async function copySingleStandardRowToSecretMenu(
  source: StandardCatalogRow,
  sortOrder: number,
): Promise<void> {
  const created = await prisma.adminCatalogItem.create({
    data: catalogItemCreateDataFromStandardRow(source, sortOrder),
    select: { id: true },
  });

  const urls = await copyCatalogItemImagesFromStandardRow(source, created.id);
  if (
    urls.itemExampleListingUrl !== source.itemExampleListingUrl ||
    urls.itemSizeExampleImageUrl !== source.itemSizeExampleImageUrl
  ) {
    await prisma.adminCatalogItem.update({
      where: { id: created.id },
      data: urls,
    });
  }
}

/** Import selected standard Admin list rows into the secret menu catalog. */
export async function importStandardAdminCatalogItemsToSecretMenu(
  sourceItemIds: string[],
): Promise<ImportStandardCatalogToSecretMenuResult> {
  const uniqueIds = [...new Set(sourceItemIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "Select at least one Admin list item to import." };
  }

  const [standardRows, secretNameKeys, maxSort] = await Promise.all([
    loadStandardCatalogRowsByIds(uniqueIds),
    loadSecretMenuNameImportKeys(),
    prisma.adminCatalogItem.aggregate({
      where: { itemSecretMenuOnly: true },
      _max: { sortOrder: true },
    }),
  ]);

  if (standardRows.length === 0) {
    return { ok: false, error: "No matching Admin list items found for import." };
  }

  const foundIds = new Set(standardRows.map((r) => r.id));
  const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return {
      ok: false,
      error: `Some selected items are missing or not on the Admin list (${missingIds.length}). Refresh and try again.`,
    };
  }

  let sortOrder = (maxSort._max.sortOrder ?? 0) + 1;
  let copiedCount = 0;
  let skippedAlreadyPresentCount = 0;

  for (const source of standardRows) {
    const nameKey = adminCatalogItemNameImportKey(source.name);
    if (secretNameKeys.has(nameKey)) {
      skippedAlreadyPresentCount += 1;
      continue;
    }

    await copySingleStandardRowToSecretMenu(source, sortOrder);
    secretNameKeys.add(nameKey);
    sortOrder += 1;
    copiedCount += 1;
  }

  if (copiedCount === 0) {
    return {
      ok: false,
      error:
        skippedAlreadyPresentCount > 0
          ? "Every selected item is already in the secret menu catalog (matched by name)."
          : "Nothing was imported.",
    };
  }

  return { ok: true, copiedCount, skippedAlreadyPresentCount };
}

/** Import every Admin list item not yet present in the secret menu (by name). */
export async function importAllMissingStandardAdminCatalogToSecretMenu(): Promise<ImportStandardCatalogToSecretMenuResult> {
  const options = await loadAdminCatalogSecretMenuImportOptions();
  const ids = options.filter((o) => !o.alreadyImported).map((o) => o.id);
  if (ids.length === 0) {
    return { ok: false, error: "Every Admin list item is already in the secret menu catalog." };
  }
  return importStandardAdminCatalogItemsToSecretMenu(ids);
}
