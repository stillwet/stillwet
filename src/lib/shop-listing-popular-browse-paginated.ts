import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getOrRebuildPlatformPopularListingOrderSnapshotIds,
  getPlatformPopularListingOrderSnapshotIds,
} from "@/lib/platform-popular-listing-order-snapshot";
import { sortListingIdsForPopularBrowseFromLightRows } from "@/lib/shop-listing-popular-browse-order-compute";

export async function fetchPopularBrowsePageSliceSnapshotOnly(args: {
  pageParam: number;
  include: Prisma.ShopListingInclude;
  pageSize: number;
  /** When set, intersect snapshot order with listings matching this filter (tag/search scope). */
  where?: Prisma.ShopListingWhereInput;
}): Promise<{
  rows: Awaited<ReturnType<typeof prisma.shopListing.findMany>>;
  totalCount: number;
  displayPage: number;
}> {
  const { pageParam, include, pageSize, where } = args;
  let ids = await getOrRebuildPlatformPopularListingOrderSnapshotIds();

  if (where && Object.keys(where).length > 0 && ids.length > 0) {
    const matching = await prisma.shopListing.findMany({
      where: { AND: [where, { id: { in: ids } }] },
      select: { id: true },
    });
    const matchSet = new Set(matching.map((m) => m.id));
    ids = ids.filter((id) => matchSet.has(id));
  }

  const totalCount = ids.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const displayPage = Math.min(Math.max(1, pageParam), totalPages);
  const skip = (displayPage - 1) * pageSize;
  const pageIds = ids.slice(skip, skip + pageSize);
  if (pageIds.length === 0) return { rows: [], totalCount, displayPage };

  const rows = await prisma.shopListing.findMany({
    where: { id: { in: pageIds } },
    include,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
  return { rows: ordered, totalCount, displayPage };
}

/**
 * Same ranking rules as legacy “Popular” browse (`sortShopListingsForPopularBrowse`), but only loads
 * full listing graphs for the requested page (typically 20 rows).
 *
 * When a daily **full-catalog Popular order** snapshot exists and every matching listing appears in it,
 * skips promo/revenue aggregation for the entire filtered set (fast path). Otherwise uses live ranking.
 */
export async function fetchPopularBrowsePageSlice(args: {
  where: Prisma.ShopListingWhereInput;
  pageParam: number;
  include: Prisma.ShopListingInclude;
  pageSize: number;
}): Promise<{
  rows: Awaited<ReturnType<typeof prisma.shopListing.findMany>>;
  totalCount: number;
  displayPage: number;
}> {
  const { where, pageParam, include, pageSize } = args;

  const listingLight = await prisma.shopListing.findMany({
    where,
    select: {
      id: true,
      product: { select: { storefrontViewCount: true, name: true } },
    },
  });
  const totalCount = listingLight.length;
  const ids = listingLight.map((r) => r.id);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const displayPage = Math.min(Math.max(1, pageParam), totalPages);
  const skip = (displayPage - 1) * pageSize;

  if (ids.length === 0) {
    return { rows: [], totalCount, displayPage };
  }

  const snapshotIds = await getPlatformPopularListingOrderSnapshotIds();

  let sortedIds: string[];

  if (snapshotIds && snapshotIds.length > 0) {
    const snapSet = new Set(snapshotIds);
    const matchSet = new Set(ids);
    const orphans = ids.filter((id) => !snapSet.has(id));
    if (orphans.length === 0) {
      sortedIds = snapshotIds.filter((id) => matchSet.has(id));
    } else {
      sortedIds = await sortListingIdsForPopularBrowseFromLightRows(listingLight);
    }
  } else {
    sortedIds = await sortListingIdsForPopularBrowseFromLightRows(listingLight);
  }

  const pageIds = sortedIds.slice(skip, skip + pageSize);

  if (pageIds.length === 0) {
    return { rows: [], totalCount, displayPage };
  }

  const rows = await prisma.shopListing.findMany({
    where: { id: { in: pageIds } },
    include,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean) as typeof rows;

  return { rows: ordered, totalCount, displayPage };
}
