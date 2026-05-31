import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const TWO_HOURS_S = 60 * 60 * 2;

export type AdminBackendNavCounts = {
  removedListingCount: number;
  adminListCount: number;
  printifyNavBadgeCount: number;
  tagsNavCount: number;
};

export const loadAdminBackendNavCounts = unstable_cache(
  async (): Promise<AdminBackendNavCounts> => {
    const [removedListingCount, adminListCount, printifyNavBadgeCount, tagsNavCount] =
      await Promise.all([
        prisma.shopListing.count({ where: { removedFromListingRequestsAt: { not: null } } }),
        prisma.adminCatalogItem.count(),
        prisma.product.count(),
        prisma.tag.count(),
      ]);
    return { removedListingCount, adminListCount, printifyNavBadgeCount, tagsNavCount };
  },
  ["admin-backend-nav-counts:v1"],
  { revalidate: TWO_HOURS_S },
);
