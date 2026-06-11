import { revalidatePath } from "next/cache";
import { OrderStatus } from "@/generated/prisma/enums";
import { revalidatePublicStorefront } from "@/lib/revalidate-public-storefront";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG, productHref } from "@/lib/marketplace-constants";
import { encodeBaselinePickItem } from "@/lib/shop-baseline-catalog";

const PICK_PREFIX = "ab|";

/** Product fields copied from an admin catalog item onto baseline listing stub products. */
export function productSyncFieldsFromAdminCatalogItem(catalog: {
  name: string;
  itemMinPriceCents: number;
}): { name: string; minPriceCents: number; priceCents: number } {
  const name = catalog.name.trim().slice(0, 500);
  const minPriceCents = Math.max(0, Math.round(catalog.itemMinPriceCents));
  return {
    name: name || "Listing request",
    minPriceCents,
    priceCents: Math.max(1, minPriceCents),
  };
}

/**
 * Deletes pending checkout orders for baseline listings so buyers restart with fresh splits.
 * @internal Exported for unit tests.
 */
export async function deletePendingCheckoutOrdersForShopListingIds(
  shopListingIds: readonly string[],
): Promise<number> {
  if (shopListingIds.length === 0) return 0;
  const result = await prisma.order.deleteMany({
    where: {
      status: OrderStatus.pending_payment,
      lines: { some: { shopListingId: { in: [...shopListingIds] } } },
    },
  });
  return result.count;
}

/**
 * Ordered tag ids assigned to an admin baseline catalog item.
 */
export async function tagIdsForAdminCatalogItem(adminCatalogItemId: string): Promise<string[]> {
  const rows = await prisma.adminCatalogItemTag.findMany({
    where: { adminCatalogItemId },
    include: { tag: { select: { id: true, sortOrder: true, name: true } } },
  });
  rows.sort((a, b) => {
    const o = a.tag.sortOrder - b.tag.sortOrder;
    if (o !== 0) return o;
    return a.tag.name.localeCompare(b.tag.name);
  });
  return rows.map((r) => r.tagId);
}

/**
 * Shop listings whose `baselineCatalogPickEncoded` refers to this admin catalog item
 * (item pick or legacy variant / all-variant encodings share the same item id prefix).
 */
async function baselineListingsForCatalogItem(adminCatalogItemId: string) {
  const exactItemPick = encodeBaselinePickItem(adminCatalogItemId);
  const prefix = `${PICK_PREFIX}${adminCatalogItemId}|`;
  return prisma.shopListing.findMany({
    where: {
      baselineCatalogPickEncoded: { not: null },
      OR: [
        { baselineCatalogPickEncoded: exactItemPick },
        { baselineCatalogPickEncoded: { startsWith: prefix } },
      ],
    },
    select: {
      id: true,
      productId: true,
      priceCents: true,
      shop: { select: { slug: true } },
      product: { select: { slug: true } },
    },
  });
}

/**
 * Replaces `ProductTag` rows and `primaryTagId` so storefront tag browse (`product.tags`) matches
 * the admin catalog item. Only for products tied to baseline listings for this catalog item.
 */
export async function applyCatalogTagsToProduct(productId: string, tagIds: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.productTag.deleteMany({ where: { productId } });
    if (tagIds.length > 0) {
      await tx.productTag.createMany({
        data: tagIds.map((tagId) => ({ productId, tagId })),
        skipDuplicates: true,
      });
    }
    await tx.product.update({
      where: { id: productId },
      data: { primaryTagId: tagIds[0] ?? null },
    });
  });
}

function revalidateAfterBaselineListingSync(params: {
  shopSlugs: string[];
  tagSlugs: string[];
  productHrefs: string[];
}): void {
  const { shopSlugs, tagSlugs, productHrefs } = params;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard/orders");
  revalidatePath("/shop/all");
  for (const slug of tagSlugs) {
    revalidatePath(`/shop/tag/${slug}`);
  }
  for (const shopSlug of shopSlugs) {
    revalidatePath(`/s/${shopSlug}`);
    for (const tagSlug of tagSlugs) {
      revalidatePath(`/s/${shopSlug}/tag/${tagSlug}`);
    }
  }
  for (const href of productHrefs) {
    revalidatePath(href);
  }
  revalidatePublicStorefront();
}

/**
 * After an admin catalog item changes, push name/min-price/tags onto every baseline listing product
 * that references it, raise listing prices below the catalog floor, invalidate stale pending
 * checkouts, then revalidate storefront and dashboard caches.
 *
 * COGS and production fees are **not** stored on listings — checkout and profit estimates read
 * `AdminCatalogItem` live via `baselineCatalogPickEncoded`.
 */
export async function syncBaselineListingsFromAdminCatalogItemId(
  adminCatalogItemId: string,
): Promise<{
  listingCount: number;
  productCount: number;
  listingsRaisedToMinPrice: number;
  pendingOrdersDeleted: number;
}> {
  const catalog = await prisma.adminCatalogItem.findUnique({
    where: { id: adminCatalogItemId },
    select: {
      name: true,
      itemMinPriceCents: true,
      itemGoodsServicesCostCents: true,
      itemProductionFeeCents: true,
    },
  });
  if (!catalog) {
    return {
      listingCount: 0,
      productCount: 0,
      listingsRaisedToMinPrice: 0,
      pendingOrdersDeleted: 0,
    };
  }

  const productFields = productSyncFieldsFromAdminCatalogItem(catalog);
  const itemMinPriceCents = productFields.minPriceCents;
  const tagIds = await tagIdsForAdminCatalogItem(adminCatalogItemId);
  const tagRows =
    tagIds.length > 0
      ? await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { slug: true } })
      : [];
  const tagSlugs = tagRows.map((t) => t.slug);

  const listings = await baselineListingsForCatalogItem(adminCatalogItemId);
  const listingIds = listings.map((row) => row.id);

  const listingsRaisedToMinPrice =
    itemMinPriceCents > 0
      ? (
          await prisma.shopListing.updateMany({
            where: {
              id: { in: listingIds },
              priceCents: { lt: itemMinPriceCents },
            },
            data: { priceCents: itemMinPriceCents },
          })
        ).count
      : 0;

  const pendingOrdersDeleted = await deletePendingCheckoutOrdersForShopListingIds(listingIds);

  const seenProduct = new Set<string>();
  const productHrefs: string[] = [];
  for (const row of listings) {
    productHrefs.push(productHref(row.shop.slug, row.product.slug));
    if (seenProduct.has(row.productId)) continue;
    seenProduct.add(row.productId);
    await prisma.product.update({
      where: { id: row.productId },
      data: productFields,
    });
    await applyCatalogTagsToProduct(row.productId, tagIds);
  }

  const shopSlugs = [...new Set(listings.map((l) => l.shop.slug))];
  const slugsForRevalidate = shopSlugs.includes(PLATFORM_SHOP_SLUG)
    ? shopSlugs
    : [...shopSlugs, PLATFORM_SHOP_SLUG];
  revalidateAfterBaselineListingSync({
    shopSlugs: slugsForRevalidate,
    tagSlugs,
    productHrefs: [...new Set(productHrefs)],
  });

  if (
    listings.length > 0 &&
    (listingsRaisedToMinPrice > 0 || pendingOrdersDeleted > 0)
  ) {
    console.info("[syncBaselineListingsFromAdminCatalogItemId] pricing sync", {
      adminCatalogItemId,
      itemMinPriceCents,
      itemGoodsServicesCostCents: catalog.itemGoodsServicesCostCents,
      itemProductionFeeCents: catalog.itemProductionFeeCents,
      listingsRaisedToMinPrice,
      pendingOrdersDeleted,
    });
  }

  return {
    listingCount: listings.length,
    productCount: seenProduct.size,
    listingsRaisedToMinPrice,
    pendingOrdersDeleted,
  };
}

/**
 * Copies admin catalog tags onto every stub/live product used by shop listings that reference
 * `adminCatalogItemId` in `baselineCatalogPickEncoded`, then revalidates storefront tag routes.
 */
export async function syncProductTagsFromAdminCatalogItemId(adminCatalogItemId: string): Promise<void> {
  await syncBaselineListingsFromAdminCatalogItemId(adminCatalogItemId);
}

/**
 * After a new baseline listing is created, copy catalog tags onto its product.
 */
export async function syncProductTagsForNewBaselineListing(params: {
  adminCatalogItemId: string;
  productId: string;
  shopSlug: string;
}): Promise<void> {
  const catalog = await prisma.adminCatalogItem.findUnique({
    where: { id: params.adminCatalogItemId },
    select: { name: true, itemMinPriceCents: true },
  });
  if (catalog) {
    await prisma.product.update({
      where: { id: params.productId },
      data: productSyncFieldsFromAdminCatalogItem(catalog),
    });
  }
  const tagIds = await tagIdsForAdminCatalogItem(params.adminCatalogItemId);
  await applyCatalogTagsToProduct(params.productId, tagIds);
  const tagRows =
    tagIds.length > 0
      ? await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { slug: true } })
      : [];
  const tagSlugs = tagRows.map((t) => t.slug);
  revalidateAfterBaselineListingSync({
    shopSlugs: [params.shopSlug, PLATFORM_SHOP_SLUG],
    tagSlugs,
    productHrefs: [],
  });
}
