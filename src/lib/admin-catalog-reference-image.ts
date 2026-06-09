import { prisma } from "@/lib/prisma";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import type { StorefrontProduct } from "@/lib/product-storefront";

/** Normalize admin catalog item image URL for display. */
export function normalizeAdminCatalogImageUrl(raw: string | null | undefined): string | null {
  const u = String(raw ?? "").trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/")) return u;
  return null;
}

/** @deprecated Use {@link normalizeAdminCatalogImageUrl} */
export const normalizeAdminCatalogExampleImageUrl = normalizeAdminCatalogImageUrl;

type PlatformLinkRow = {
  itemSizeExampleImageUrl?: string | null;
};

/** Product shape needed for catalog size-example resolution (browse rows may include fewer link fields). */
export type ProductForCatalogSizeExample = {
  id: string;
  adminCatalogItemPlatformLinks?: PlatformLinkRow[] | null;
};

/** First linked admin catalog item size example URL on the product (sync, no baseline pick). */
export function adminCatalogSizeExampleFromPlatformLinks(
  product: ProductForCatalogSizeExample,
): string | null {
  for (const x of product.adminCatalogItemPlatformLinks ?? []) {
    const u = normalizeAdminCatalogImageUrl(x.itemSizeExampleImageUrl);
    if (u) return u;
  }
  return null;
}

/** @deprecated Use {@link adminCatalogSizeExampleFromPlatformLinks} */
export const adminCatalogReferenceFromPlatformLinks = adminCatalogSizeExampleFromPlatformLinks;

/**
 * Per-catalog-item size example photo for storefront PDP galleries:
 * 1) listing baseline pick → AdminCatalogItem.itemSizeExampleImageUrl
 * 2) product platform links
 * 3) itemPlatformProductId match
 */
export async function resolveAdminCatalogItemSizeExampleImageUrl(
  product: StorefrontProduct | ProductForCatalogSizeExample,
  listing: { baselineCatalogPickEncoded?: string | null } | null,
): Promise<string | null> {
  if (listing?.baselineCatalogPickEncoded) {
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded);
    if (pick) {
      const item = await prisma.adminCatalogItem.findUnique({
        where: { id: pick.itemId },
        select: { itemSizeExampleImageUrl: true },
      });
      const fromPick = normalizeAdminCatalogImageUrl(item?.itemSizeExampleImageUrl);
      if (fromPick) return fromPick;
    }
  }

  const fromLinks = adminCatalogSizeExampleFromPlatformLinks(product);
  if (fromLinks) return fromLinks;

  const direct = await prisma.adminCatalogItem.findFirst({
    where: { itemPlatformProductId: product.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { itemSizeExampleImageUrl: true },
  });
  return normalizeAdminCatalogImageUrl(direct?.itemSizeExampleImageUrl);
}

/** @deprecated Use {@link resolveAdminCatalogItemSizeExampleImageUrl} */
export const resolveAdminCatalogItemExampleImageUrl = resolveAdminCatalogItemSizeExampleImageUrl;

export type ListingRowForCatalogSizeExample = {
  id: string;
  baselineCatalogPickEncoded?: string | null;
  product: ProductForCatalogSizeExample;
};

/** @deprecated Use {@link ListingRowForCatalogSizeExample} */
export type ListingRowForCatalogReference = ListingRowForCatalogSizeExample;

/** Batch-resolve size example URLs for browse grids (one query for baseline picks). */
export async function batchResolveAdminCatalogSizeExampleImageUrls(
  listings: ListingRowForCatalogSizeExample[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (listings.length === 0) return out;

  const itemIds = new Set<string>();
  for (const row of listings) {
    const pick = parseBaselinePick(row.baselineCatalogPickEncoded ?? "");
    if (pick) itemIds.add(pick.itemId);
  }

  const itemUrlById = new Map<string, string>();
  if (itemIds.size > 0) {
    const items = await prisma.adminCatalogItem.findMany({
      where: { id: { in: [...itemIds] } },
      select: { id: true, itemSizeExampleImageUrl: true },
    });
    for (const item of items) {
      const u = normalizeAdminCatalogImageUrl(item.itemSizeExampleImageUrl);
      if (u) itemUrlById.set(item.id, u);
    }
  }

  const productIdsNeedingDirect = new Set<string>();
  for (const row of listings) {
    const pick = parseBaselinePick(row.baselineCatalogPickEncoded ?? "");
    const fromPick = pick ? itemUrlById.get(pick.itemId) : null;
    if (fromPick) {
      out.set(row.id, fromPick);
      continue;
    }
    const fromLinks = adminCatalogSizeExampleFromPlatformLinks(row.product);
    if (fromLinks) {
      out.set(row.id, fromLinks);
      continue;
    }
    productIdsNeedingDirect.add(row.product.id);
  }

  if (productIdsNeedingDirect.size > 0) {
    const directRows = await prisma.adminCatalogItem.findMany({
      where: { itemPlatformProductId: { in: [...productIdsNeedingDirect] } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { itemPlatformProductId: true, itemSizeExampleImageUrl: true },
    });
    const directByProductId = new Map<string, string>();
    for (const row of directRows) {
      const pid = row.itemPlatformProductId?.trim();
      if (!pid || directByProductId.has(pid)) continue;
      const u = normalizeAdminCatalogImageUrl(row.itemSizeExampleImageUrl);
      if (u) directByProductId.set(pid, u);
    }
    for (const listing of listings) {
      if (out.has(listing.id)) continue;
      const u = directByProductId.get(listing.product.id);
      if (u) out.set(listing.id, u);
    }
  }

  return out;
}

/** @deprecated Use {@link batchResolveAdminCatalogSizeExampleImageUrls} */
export const batchResolveAdminCatalogReferenceImageUrls = batchResolveAdminCatalogSizeExampleImageUrls;
