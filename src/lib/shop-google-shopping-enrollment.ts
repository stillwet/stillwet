import { revalidatePath } from "next/cache";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";

export type GoogleShoppingListingPicklistEntry = { id: string; label: string };

export function shopListingLabelForGoogleShopping(listing: {
  requestItemName: string | null;
  product: { name: string };
}): string {
  return (listing.requestItemName && listing.requestItemName.trim()) || listing.product.name;
}

const googleShoppingEligibleListingWhere = {
  ...storefrontShopListingWhere,
  requestStatus: ListingRequestStatus.approved,
} as const;

export async function loadGoogleShoppingListingPicklistForShop(
  shopId: string,
): Promise<{ eligible: GoogleShoppingListingPicklistEntry[]; enrolledIds: string[] }> {
  const [listings, enrollments] = await Promise.all([
    prisma.shopListing.findMany({
      where: { shopId, ...googleShoppingEligibleListingWhere },
      select: {
        id: true,
        requestItemName: true,
        product: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.shopListingGoogleShoppingEnrollment.findMany({
      where: { shopId },
      select: { shopListingId: true },
    }),
  ]);

  const enrolledSet = new Set(enrollments.map((e) => e.shopListingId));
  const enrolledIds = [...enrolledSet];

  const eligible = listings
    .filter((l) => !enrolledSet.has(l.id))
    .map((l) => ({
      id: l.id,
      label: shopListingLabelForGoogleShopping(l),
    }));

  return { eligible, enrolledIds };
}

export type AssignGoogleShoppingListingsResult =
  | { ok: true; enrolledCount: number }
  | { ok: false; error: string };

/**
 * Permanently enrolls listings in Google Shopping and consumes one credit per listing.
 */
export async function assignGoogleShoppingCreditsToListings(
  shopId: string,
  shopUserId: string,
  listingIds: string[],
): Promise<AssignGoogleShoppingListingsResult> {
  const uniqueIds = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "Select at least one listing." };
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { googleShoppingCredits: true },
  });
  if (!shop) return { ok: false, error: "Shop not found." };
  if (uniqueIds.length > shop.googleShoppingCredits) {
    return {
      ok: false,
      error: `You only have ${shop.googleShoppingCredits} Google Shopping credit${shop.googleShoppingCredits === 1 ? "" : "s"} available.`,
    };
  }

  const listings = await prisma.shopListing.findMany({
    where: {
      id: { in: uniqueIds },
      shopId,
      ...googleShoppingEligibleListingWhere,
    },
    select: { id: true },
  });
  if (listings.length !== uniqueIds.length) {
    return {
      ok: false,
      error: "One or more listings are not eligible (must be approved and visible on your storefront).",
    };
  }

  const alreadyEnrolled = await prisma.shopListingGoogleShoppingEnrollment.count({
    where: { shopListingId: { in: uniqueIds } },
  });
  if (alreadyEnrolled > 0) {
    return { ok: false, error: "One or more listings are already enrolled in Google Shopping." };
  }

  const n = uniqueIds.length;
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const decremented = await tx.shop.updateMany({
        where: { id: shopId, googleShoppingCredits: { gte: n } },
        data: { googleShoppingCredits: { decrement: n } },
      });
      if (decremented.count === 0) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      await tx.shopListingGoogleShoppingEnrollment.createMany({
        data: uniqueIds.map((shopListingId) => ({
          shopId,
          shopListingId,
          gmcOfferId: shopListingId,
          enrolledAt: now,
          enrolledByShopUserId: shopUserId,
        })),
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
      return { ok: false, error: "Not enough Google Shopping credits available." };
    }
    return {
      ok: false,
      error: "Could not enroll listings. They may already be enrolled.",
    };
  }

  revalidateShopUpgradesDashboardPaths();
  revalidatePath("/admin");

  void import("@/lib/google-merchant/sync")
    .then(({ syncGoogleMerchantEnrollmentsByListingIds }) =>
      syncGoogleMerchantEnrollmentsByListingIds(uniqueIds),
    )
    .catch((err) => {
      console.error("[google-merchant] post-enroll sync failed:", err);
    });

  return { ok: true, enrolledCount: n };
}
