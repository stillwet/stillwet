import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG, productHref } from "@/lib/marketplace-constants";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { shopListingLabelForGoogleShopping } from "@/lib/shop-google-shopping-enrollment";

export type AdminGoogleShoppingEnrollmentRow = {
  shopSlug: string;
  shopDisplayName: string;
  shopActive: boolean;
  listingId: string;
  listingLabel: string;
  enrolledAt: string;
  listingUrl: string;
  gmcSyncStatus: string;
  gmcApprovalStatus: string | null;
  gmcLastSyncedAt: string | null;
  gmcLastSyncError: string | null;
};

const ADMIN_ENROLLMENT_EXPORT_LIMIT = 5000;

export async function loadAdminGoogleShoppingEnrollments(): Promise<
  AdminGoogleShoppingEnrollmentRow[]
> {
  const base = publicAppBaseUrl()?.replace(/\/$/, "") || "http://localhost:3000";

  const rows = await prisma.shopListingGoogleShoppingEnrollment.findMany({
    orderBy: { enrolledAt: "desc" },
    take: ADMIN_ENROLLMENT_EXPORT_LIMIT,
    select: {
      shopListingId: true,
      enrolledAt: true,
      gmcSyncStatus: true,
      gmcApprovalStatus: true,
      gmcLastSyncedAt: true,
      gmcLastSyncError: true,
      shop: {
        select: {
          slug: true,
          displayName: true,
          active: true,
        },
      },
      shopListing: {
        select: {
          requestItemName: true,
          product: { select: { name: true, slug: true } },
        },
      },
    },
  });

  return rows
    .filter((r) => r.shop.slug !== PLATFORM_SHOP_SLUG)
    .map((r) => ({
      shopSlug: r.shop.slug,
      shopDisplayName: r.shop.displayName,
      shopActive: r.shop.active,
      listingId: r.shopListingId,
      listingLabel: shopListingLabelForGoogleShopping(r.shopListing),
      enrolledAt: r.enrolledAt.toISOString(),
      listingUrl: `${base}${productHref(r.shop.slug, r.shopListing.product.slug)}`,
      gmcSyncStatus: r.gmcSyncStatus,
      gmcApprovalStatus: r.gmcApprovalStatus,
      gmcLastSyncedAt: r.gmcLastSyncedAt?.toISOString() ?? null,
      gmcLastSyncError: r.gmcLastSyncError,
    }));
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildGoogleShoppingEnrollmentsCsv(rows: AdminGoogleShoppingEnrollmentRow[]): string {
  const header = [
    "shop_slug",
    "display_name",
    "shop_active",
    "listing_id",
    "listing_label",
    "enrolled_at",
    "listing_url",
    "gmc_sync_status",
    "gmc_approval_status",
    "gmc_last_synced_at",
    "gmc_last_sync_error",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.shopSlug),
        csvEscape(r.shopDisplayName),
        r.shopActive ? "true" : "false",
        csvEscape(r.listingId),
        csvEscape(r.listingLabel),
        csvEscape(r.enrolledAt),
        csvEscape(r.listingUrl),
        csvEscape(r.gmcSyncStatus),
        csvEscape(r.gmcApprovalStatus ?? ""),
        csvEscape(r.gmcLastSyncedAt ?? ""),
        csvEscape(r.gmcLastSyncError ?? ""),
      ].join(","),
    ),
  ];
  return lines.join("\n");
}
