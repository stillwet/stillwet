import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  adminCatalogItemReferenceImageObjectKey,
  adminCatalogItemSizeExampleImageObjectKey,
  catalogItemReferenceImageUrlToObjectKey,
  catalogItemSizeExampleImageUrlToObjectKey,
  copyR2ObjectWithinBucket,
  deleteAdminCatalogItemReferenceObject,
  deleteAdminCatalogItemSizeExampleObject,
  publicHttpsUrlForR2ObjectKey,
} from "@/lib/r2-upload";

export type CopyStandardCatalogToSecretMenuResult =
  | { ok: true; copiedCount: number }
  | { ok: false; error: string };

type StandardCatalogRow = Awaited<ReturnType<typeof loadStandardCatalogRowsForCopy>>[number];

async function loadStandardCatalogRowsForCopy() {
  return prisma.adminCatalogItem.findMany({
    where: { itemSecretMenuOnly: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { catalogTags: { select: { tagId: true } } },
  });
}

async function deleteSecretMenuCatalogItems(): Promise<void> {
  const existing = await prisma.adminCatalogItem.findMany({
    where: { itemSecretMenuOnly: true },
    select: { id: true },
  });
  if (existing.length === 0) return;

  await prisma.adminCatalogItem.deleteMany({ where: { itemSecretMenuOnly: true } });

  await Promise.all(
    existing.map(async ({ id }) => {
      await deleteAdminCatalogItemReferenceObject(id);
      await deleteAdminCatalogItemSizeExampleObject(id);
    }),
  );
}

function catalogItemCreateDataFromStandardRow(
  source: StandardCatalogRow,
): Prisma.AdminCatalogItemCreateInput {
  return {
    name: source.name,
    sortOrder: source.sortOrder,
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

/** Duplicate standard Admin list rows into the secret menu catalog. */
export async function copyStandardAdminCatalogToSecretMenu(options?: {
  replaceExisting?: boolean;
}): Promise<CopyStandardCatalogToSecretMenuResult> {
  const replaceExisting = options?.replaceExisting ?? false;

  const [standardRows, secretCount] = await Promise.all([
    loadStandardCatalogRowsForCopy(),
    prisma.adminCatalogItem.count({ where: { itemSecretMenuOnly: true } }),
  ]);

  if (standardRows.length === 0) {
    return { ok: false, error: "The Admin list has no standard catalog items to copy." };
  }

  if (secretCount > 0 && !replaceExisting) {
    return {
      ok: false,
      error: `Secret menu already has ${secretCount} item(s). Replace them first or confirm replace.`,
    };
  }

  if (replaceExisting && secretCount > 0) {
    await deleteSecretMenuCatalogItems();
  }

  let copiedCount = 0;
  for (const source of standardRows) {
    const created = await prisma.adminCatalogItem.create({
      data: catalogItemCreateDataFromStandardRow(source),
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

    copiedCount += 1;
  }

  return { ok: true, copiedCount };
}
