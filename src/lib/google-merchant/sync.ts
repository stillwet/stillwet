import { GoogleMerchantSyncStatus } from "@/generated/prisma/enums";
import {
  deleteGoogleMerchantProductInput,
  getGoogleMerchantProduct,
  insertGoogleMerchantProductInput,
} from "@/lib/google-merchant/api-client";
import {
  googleMerchantConfigFromEnv,
  type GoogleMerchantConfig,
} from "@/lib/google-merchant/config";
import { isListingEligibleForGoogleMerchantSync } from "@/lib/google-merchant/listing-eligibility";
import {
  buildGoogleMerchantProductInput,
  hashGoogleMerchantProductInput,
  type GoogleMerchantListingSource,
} from "@/lib/google-merchant/listing-product-input";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const REFRESH_AFTER_MS = 25 * 24 * 60 * 60 * 1000;

const enrollmentSelect = {
  id: true,
  shopListingId: true,
  gmcOfferId: true,
  gmcProductName: true,
  gmcSyncStatus: true,
  gmcSyncPayloadHash: true,
  gmcLastSyncedAt: true,
  shop: {
    select: {
      slug: true,
      displayName: true,
      active: true,
      stripeConnectAccountId: true,
      connectChargesEnabled: true,
    },
  },
  shopListing: {
    select: {
      priceCents: true,
      active: true,
      requestStatus: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
      hiddenStorefrontForAccountDeletionAt: true,
      requestItemName: true,
      storefrontItemBlurb: true,
      baselineCatalogPickEncoded: true,
      product: {
        select: {
          slug: true,
          name: true,
          imageUrl: true,
          imageGallery: true,
          adminCatalogItemPlatformLinks: {
            select: { storefrontDescription: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  },
} satisfies Prisma.ShopListingGoogleShoppingEnrollmentSelect;

type EnrollmentRow = Awaited<
  ReturnType<typeof loadEnrollmentForSync>
> extends infer T
  ? T extends null
    ? never
    : T
  : never;

async function loadEnrollmentForSync(where: { id: string } | { shopListingId: string }) {
  return prisma.shopListingGoogleShoppingEnrollment.findFirst({
    where,
    select: enrollmentSelect,
  });
}

async function loadEnrollmentsForReconcile(limit: number) {
  return prisma.shopListingGoogleShoppingEnrollment.findMany({
    where: {
      gmcSyncStatus: {
        in: [
          GoogleMerchantSyncStatus.pending,
          GoogleMerchantSyncStatus.synced,
          GoogleMerchantSyncStatus.error,
        ],
      },
    },
    orderBy: [{ gmcLastSyncedAt: "asc" }, { enrolledAt: "asc" }],
    take: limit,
    select: { id: true },
  });
}

async function toListingSource(row: NonNullable<EnrollmentRow>): Promise<GoogleMerchantListingSource> {
  const product = row.shopListing.product;
  const description = await resolveEnrollmentStorefrontDescription({
    baselineCatalogPickEncoded: row.shopListing.baselineCatalogPickEncoded,
    adminCatalogItemPlatformLinks: product.adminCatalogItemPlatformLinks,
  });

  return {
    enrollmentId: row.id,
    shopListingId: row.shopListingId,
    gmcOfferId: row.gmcOfferId,
    shopSlug: row.shop.slug,
    shopDisplayName: row.shop.displayName,
    shopActive: row.shop.active,
    shopStripeConnectAccountId: row.shop.stripeConnectAccountId,
    shopConnectChargesEnabled: row.shop.connectChargesEnabled,
    listing: {
      priceCents: row.shopListing.priceCents,
      active: row.shopListing.active,
      requestStatus: row.shopListing.requestStatus,
      creatorRemovedFromShopAt: row.shopListing.creatorRemovedFromShopAt,
      adminRemovedFromShopAt: row.shopListing.adminRemovedFromShopAt,
      hiddenStorefrontForAccountDeletionAt:
        row.shopListing.hiddenStorefrontForAccountDeletionAt,
      requestItemName: row.shopListing.requestItemName,
      storefrontItemBlurb: row.shopListing.storefrontItemBlurb,
    },
    product: {
      slug: product.slug,
      name: product.name,
      imageUrl: product.imageUrl,
      imageGallery: product.imageGallery,
    },
    description,
  };
}

async function resolveEnrollmentStorefrontDescription(args: {
  baselineCatalogPickEncoded: string | null;
  adminCatalogItemPlatformLinks: Array<{ storefrontDescription: string | null }>;
}): Promise<string> {
  const baseline = args.baselineCatalogPickEncoded?.trim() || "";
  if (baseline) {
    const pick = parseBaselinePick(baseline);
    if (pick) {
      const item = await prisma.adminCatalogItem.findUnique({
        where: { id: pick.itemId },
        select: { storefrontDescription: true },
      });
      const t = item?.storefrontDescription?.trim() || "";
      if (t) return t;
    }
  }

  for (const x of args.adminCatalogItemPlatformLinks) {
    const t = x.storefrontDescription?.trim() || "";
    if (t) return t;
  }
  return "";
}

async function markEnrollmentError(enrollmentId: string, error: string): Promise<void> {
  await prisma.shopListingGoogleShoppingEnrollment.update({
    where: { id: enrollmentId },
    data: {
      gmcSyncStatus: GoogleMerchantSyncStatus.error,
      gmcLastSyncError: error.slice(0, 4000),
    },
  });
}

async function removeFromMerchant(
  config: GoogleMerchantConfig,
  enrollmentId: string,
  offerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const del = await deleteGoogleMerchantProductInput(config, offerId);
  if (!del.ok) {
    await markEnrollmentError(enrollmentId, del.error);
    return del;
  }

  await prisma.shopListingGoogleShoppingEnrollment.update({
    where: { id: enrollmentId },
    data: {
      gmcSyncStatus: GoogleMerchantSyncStatus.removed,
      gmcRemovedFromMerchantAt: new Date(),
      gmcLastSyncError: null,
      gmcApprovalStatus: null,
    },
  });
  return { ok: true };
}

export async function syncGoogleMerchantEnrollmentById(
  enrollmentId: string,
): Promise<{ ok: true; action: string } | { ok: false; error: string }> {
  const config = googleMerchantConfigFromEnv();
  if (!config) {
    return { ok: false, error: "Google Merchant sync is not configured." };
  }

  const row = await loadEnrollmentForSync({ id: enrollmentId });
  if (!row) return { ok: false, error: "Enrollment not found." };

  return syncGoogleMerchantEnrollmentRow(config, row);
}

export async function syncGoogleMerchantEnrollmentsByListingIds(
  shopListingIds: string[],
): Promise<{ synced: number; errors: number; skipped: number }> {
  const config = googleMerchantConfigFromEnv();
  if (!config || shopListingIds.length === 0) {
    return { synced: 0, errors: 0, skipped: shopListingIds.length };
  }

  let synced = 0;
  let errors = 0;
  let skipped = 0;

  for (const shopListingId of shopListingIds) {
    const row = await loadEnrollmentForSync({ shopListingId });
    if (!row) {
      skipped++;
      continue;
    }
    const r = await syncGoogleMerchantEnrollmentRow(config, row);
    if (r.ok) synced++;
    else errors++;
  }

  return { synced, errors, skipped };
}

async function syncGoogleMerchantEnrollmentRow(
  config: GoogleMerchantConfig,
  row: NonNullable<EnrollmentRow>,
): Promise<{ ok: true; action: string } | { ok: false; error: string }> {
  const source = await toListingSource(row);
  const eligible = isListingEligibleForGoogleMerchantSync(source);

  if (!eligible) {
    if (
      row.gmcSyncStatus === GoogleMerchantSyncStatus.synced ||
      row.gmcProductName
    ) {
      const removed = await removeFromMerchant(config, row.id, row.gmcOfferId);
      if (!removed.ok) return removed;
      return { ok: true, action: "removed" };
    }
    await prisma.shopListingGoogleShoppingEnrollment.update({
      where: { id: row.id },
      data: {
        gmcSyncStatus: GoogleMerchantSyncStatus.pending,
        gmcLastSyncError: "Listing is not eligible for Google Merchant (not live on storefront).",
      },
    });
    return { ok: true, action: "skipped_ineligible" };
  }

  const built = buildGoogleMerchantProductInput(source, config);
  if ("error" in built) {
    await markEnrollmentError(row.id, built.error);
    return { ok: false, error: built.error };
  }

  const hash = hashGoogleMerchantProductInput(built);
  const forceRefresh =
    !row.gmcLastSyncedAt ||
    Date.now() - row.gmcLastSyncedAt.getTime() > REFRESH_AFTER_MS;

  if (
    row.gmcSyncStatus === GoogleMerchantSyncStatus.synced &&
    row.gmcSyncPayloadHash === hash &&
    !forceRefresh
  ) {
    return { ok: true, action: "unchanged" };
  }

  const inserted = await insertGoogleMerchantProductInput(config, built);
  if (!inserted.ok) {
    await markEnrollmentError(row.id, inserted.error);
    return { ok: false, error: inserted.error };
  }

  await prisma.shopListingGoogleShoppingEnrollment.update({
    where: { id: row.id },
    data: {
      gmcSyncStatus: GoogleMerchantSyncStatus.synced,
      gmcSyncPayloadHash: hash,
      gmcLastSyncedAt: new Date(),
      gmcLastSyncError: null,
      gmcProductName: inserted.productName ?? inserted.productInputName,
      gmcRemovedFromMerchantAt: null,
    },
  });

  return { ok: true, action: row.gmcSyncStatus === GoogleMerchantSyncStatus.synced ? "updated" : "inserted" };
}

async function pollEnrollmentApproval(
  config: GoogleMerchantConfig,
  enrollmentId: string,
  offerId: string,
): Promise<void> {
  const polled = await getGoogleMerchantProduct(config, offerId);
  if (!polled.ok) return;

  await prisma.shopListingGoogleShoppingEnrollment.update({
    where: { id: enrollmentId },
    data: {
      gmcApprovalStatus: polled.approvalStatus,
      gmcLastStatusPollAt: new Date(),
      gmcProductName: polled.product.name ?? undefined,
    },
  });
}

export async function reconcileGoogleMerchantEnrollments(options?: {
  batchSize?: number;
  pollStatus?: boolean;
}): Promise<{
  ok: true;
  processed: number;
  insertedOrUpdated: number;
  removed: number;
  unchanged: number;
  errors: number;
  statusPolled: number;
}> {
  const config = googleMerchantConfigFromEnv();
  if (!config) {
    return {
      ok: true,
      processed: 0,
      insertedOrUpdated: 0,
      removed: 0,
      unchanged: 0,
      errors: 0,
      statusPolled: 0,
    };
  }

  const batchSize = options?.batchSize ?? 50;
  const pollStatus = options?.pollStatus ?? true;
  const ids = await loadEnrollmentsForReconcile(batchSize);

  let insertedOrUpdated = 0;
  let removed = 0;
  let unchanged = 0;
  let errors = 0;
  let statusPolled = 0;

  for (const { id } of ids) {
    const row = await loadEnrollmentForSync({ id });
    if (!row) continue;

    const r = await syncGoogleMerchantEnrollmentRow(config, row);
    if (!r.ok) {
      errors++;
      continue;
    }
    if (r.action === "removed") removed++;
    else if (r.action === "unchanged" || r.action === "skipped_ineligible") unchanged++;
    else insertedOrUpdated++;

    if (
      pollStatus &&
      (r.action === "inserted" ||
        r.action === "updated" ||
        row.gmcSyncStatus === GoogleMerchantSyncStatus.synced)
    ) {
      await pollEnrollmentApproval(config, row.id, row.gmcOfferId);
      statusPolled++;
    }
  }

  return {
    ok: true,
    processed: ids.length,
    insertedOrUpdated,
    removed,
    unchanged,
    errors,
    statusPolled,
  };
}

/** Build ProductInput JSON for admin preview (no API call). */
export async function previewGoogleMerchantProductInputForListing(
  shopListingId: string,
): Promise<
  | { ok: true; input: ReturnType<typeof buildGoogleMerchantProductInput> extends infer T ? (T extends { error: string } ? never : T) : never }
  | { ok: false; error: string }
> {
  const config = googleMerchantConfigFromEnv();
  const previewConfig: GoogleMerchantConfig =
    config ??
    ({
      enabled: false,
      accountId: "0",
      dataSourceId: "0",
      dataSourceName: "accounts/0/dataSources/0",
      feedLabel: process.env.GOOGLE_MERCHANT_FEED_LABEL?.trim() || "US",
      contentLanguage: process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE?.trim() || "en",
      defaultProductCategory:
        process.env.GOOGLE_MERCHANT_DEFAULT_PRODUCT_CATEGORY?.trim() ||
        "Apparel & Accessories",
      serviceAccount: { clientEmail: "preview@local", privateKey: "" },
    } satisfies GoogleMerchantConfig);

  const row = await loadEnrollmentForSync({ shopListingId });
  if (!row) return { ok: false, error: "Listing is not enrolled in Google Shopping." };

  const source = await toListingSource(row);
  const built = buildGoogleMerchantProductInput(source, previewConfig);
  if ("error" in built) return { ok: false, error: built.error };
  return { ok: true, input: built };
}
