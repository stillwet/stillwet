import { prisma } from "@/lib/prisma";
import { shopListingLabelForGoogleShopping } from "@/lib/shop-google-shopping-enrollment";

export type ShopGoogleShoppingEnrolledListingRow = {
  id: string;
  label: string;
  enrolledAtIso: string;
};

export type ShopGoogleShoppingDashboardPayload = {
  creditsAvailable: number;
  enrolled: ShopGoogleShoppingEnrolledListingRow[];
};

const ENROLLED_PREVIEW_LIMIT = 20;

export async function loadShopGoogleShoppingDashboardPayload(
  shopId: string,
): Promise<ShopGoogleShoppingDashboardPayload> {
  const [shop, enrollments] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: shopId },
      select: { googleShoppingCredits: true },
    }),
    prisma.shopListingGoogleShoppingEnrollment.findMany({
      where: { shopId },
      orderBy: { enrolledAt: "desc" },
      take: ENROLLED_PREVIEW_LIMIT,
      select: {
        shopListingId: true,
        enrolledAt: true,
        shopListing: {
          select: {
            requestItemName: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return {
    creditsAvailable: shop?.googleShoppingCredits ?? 0,
    enrolled: enrollments.map((e) => ({
      id: e.shopListingId,
      label: shopListingLabelForGoogleShopping(e.shopListing),
      enrolledAtIso: e.enrolledAt.toISOString(),
    })),
  };
}
