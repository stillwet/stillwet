import { parseAdminCatalogVariantsJson } from "@/lib/admin-catalog-item";
import { prisma, prismaOrderReturnClaimOrNull } from "@/lib/prisma";
import { productAllStoredImageUrls } from "@/lib/product-media";
import { SITE_EMAIL_LOGO_R2_OBJECT_KEY } from "@/lib/site-email-logo-constants";
import {
  deleteR2ObjectsByKeysForPrune,
  isR2UploadConfigured,
  listAllR2ObjectKeys,
  publicUrlToR2ObjectKey,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";

function addUrlToReferencedR2Keys(url: string | null | undefined, keys: Set<string>): void {
  const u = url?.trim();
  if (!u) return;
  const key = publicUrlToR2ObjectKey(u);
  if (key) keys.add(key);
}

function addJsonStringArrayUrls(json: unknown, keys: Set<string>): void {
  if (!Array.isArray(json)) return;
  for (const x of json) {
    if (typeof x === "string") addUrlToReferencedR2Keys(x, keys);
  }
}

function addR2KeyToReferenced(key: string | null | undefined, keys: Set<string>): void {
  const k = key?.trim();
  if (k) keys.add(k);
}

/** Group orphan keys by first path segment for reporting (e.g. `shops/`, `admin-catalog/`). */
export function summarizeOrphanR2KeysByPrefix(keys: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of keys) {
    const slash = key.indexOf("/");
    const prefix = slash >= 0 ? `${key.slice(0, slash + 1)}` : key;
    counts[prefix] = (counts[prefix] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

/**
 * R2 object keys referenced from the database (any path under `R2_PUBLIC_BASE_URL` that
 * {@link publicUrlToR2ObjectKey} can resolve), plus stable non-DB keys that must be kept.
 */
export async function collectReferencedR2ObjectKeysFromDatabase(): Promise<Set<string>> {
  const keys = new Set<string>();

  keys.add(SITE_EMAIL_LOGO_R2_OBJECT_KEY);

  const products = await prisma.product.findMany({
    select: {
      imageUrl: true,
      imageGallery: true,
    },
  });
  for (const p of products) {
    for (const url of productAllStoredImageUrls(p)) {
      addUrlToReferencedR2Keys(url, keys);
    }
  }

  const shops = await prisma.shop.findMany({
    select: { profileImageUrl: true },
  });
  for (const s of shops) {
    addUrlToReferencedR2Keys(s.profileImageUrl, keys);
  }

  const listings = await prisma.shopListing.findMany({
    select: {
      requestImages: true,
      ownerSupplementImageUrl: true,
      ownerSupplementPendingImageUrl: true,
      adminListingSecondaryImageUrl: true,
      listingStorefrontCatalogImageUrls: true,
    },
  });
  for (const l of listings) {
    for (const u of shopListingRequestImageUrlStrings(l.requestImages)) {
      addUrlToReferencedR2Keys(u, keys);
    }
    addUrlToReferencedR2Keys(l.ownerSupplementImageUrl, keys);
    addUrlToReferencedR2Keys(l.ownerSupplementPendingImageUrl, keys);
    addUrlToReferencedR2Keys(l.adminListingSecondaryImageUrl, keys);
    addJsonStringArrayUrls(l.listingStorefrontCatalogImageUrls, keys);
  }

  const catalogItems = await prisma.adminCatalogItem.findMany({
    select: { itemExampleListingUrl: true, itemSizeExampleImageUrl: true, variants: true },
  });
  for (const row of catalogItems) {
    addUrlToReferencedR2Keys(row.itemExampleListingUrl, keys);
    addUrlToReferencedR2Keys(row.itemSizeExampleImageUrl, keys);
    for (const v of parseAdminCatalogVariantsJson(row.variants)) {
      addUrlToReferencedR2Keys(v.exampleListingUrl, keys);
    }
  }

  const bugReports = await prisma.bugFeedbackReport.findMany({
    where: { imageDeletedAt: null },
    select: { imageUrl: true, imageR2Key: true },
  });
  for (const row of bugReports) {
    addR2KeyToReferenced(row.imageR2Key, keys);
    addUrlToReferencedR2Keys(row.imageUrl, keys);
  }

  const returnClaimDelegate = prismaOrderReturnClaimOrNull();
  const returnClaimImageDelegate = (
    prisma as {
      orderReturnClaimImage?: {
        findMany: (args: unknown) => Promise<
          { imageUrl: string; imageR2Key: string }[]
        >;
      };
    }
  ).orderReturnClaimImage;
  if (returnClaimImageDelegate?.findMany) {
    const claimImages = await returnClaimImageDelegate.findMany({
      select: { imageUrl: true, imageR2Key: true },
    });
    for (const img of claimImages) {
      addR2KeyToReferenced(img.imageR2Key, keys);
      addUrlToReferencedR2Keys(img.imageUrl, keys);
    }
  }

  return keys;
}

export type PruneOrphanListingImagesResult = {
  listedObjectCount: number;
  referencedKeyCount: number;
  orphanKeyCount: number;
  orphanKeysSample: string[];
  orphanKeysByPrefix: Record<string, number>;
  deletedCount: number;
};

const ORPHAN_SAMPLE_MAX = 40;

/**
 * List every object in the R2 bucket and delete keys not referenced from the database
 * (products, shops, shop listings, admin catalog, bug feedback, return claims, etc.).
 */
export async function pruneOrphanListingImagesFromR2(options: {
  dryRun: boolean;
}): Promise<PruneOrphanListingImagesResult> {
  if (!isR2UploadConfigured()) {
    throw new Error("R2 is not configured");
  }
  const referenced = await collectReferencedR2ObjectKeysFromDatabase();
  const allKeys = await listAllR2ObjectKeys();
  const orphans = allKeys.filter((k) => !referenced.has(k));
  let deletedCount = 0;
  if (!options.dryRun && orphans.length > 0) {
    deletedCount = await deleteR2ObjectsByKeysForPrune(orphans);
  }
  return {
    listedObjectCount: allKeys.length,
    referencedKeyCount: referenced.size,
    orphanKeyCount: orphans.length,
    orphanKeysSample: orphans.slice(0, ORPHAN_SAMPLE_MAX),
    orphanKeysByPrefix: summarizeOrphanR2KeysByPrefix(orphans),
    deletedCount,
  };
}
