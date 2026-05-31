import { prisma, prismaAdminInboundEmailOrNull } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ListingRequestStatus, OrderStatus } from "@/generated/prisma/enums";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import { ConfirmDeleteForm } from "@/components/ConfirmDeleteForm";
import { productHasTag } from "@/lib/product-tags";
import { emailLinkOrigin, publicAppBaseUrl } from "@/lib/public-app-url";
import {
  buildAdminEmailFormatEntries,
  loadSiteEmailSendPreviewsForAdmin,
} from "@/lib/site-email-template-service";
import { PrintifyApiTab } from "./printify-api-tab";
import { PrintifyInventoryTab } from "./printify-inventory-tab";
import { AdminPlatformSalesTab } from "@/components/admin/AdminPlatformSalesTab";
import {
  loadMergedPlatformSalesLines,
  loadPlatformSalesCurrentMonthTotals,
  loadPlatformSalesPreviousMonthTotals,
  loadPlatformSalesPriorCalendarYearTotals,
  loadPlatformSalesYtdTotals,
  type AdminPlatformSalesMergedLine,
  type PlatformSalesPeriodTotals,
  type PlatformSalesYtdTotals,
} from "@/lib/admin-platform-sales-merged-lines";
import { loadAdminShopLeaderboardRows } from "@/lib/admin-shop-leaderboard-load";
import { AdminShopLeaderboardTab } from "@/components/admin/AdminShopLeaderboardTab";
import {
  AdminListingRequestsTab,
  type ListingRequestTabRow,
} from "@/components/admin/AdminListingRequestsTab";
import { AdminListingSupplementImageRequestsTab } from "@/components/admin/AdminListingSupplementImageRequestsTab";
import { AdminBugFeedbackTab, type AdminBugFeedbackRow } from "@/components/admin/AdminBugFeedbackTab";
import {
  AdminRemovedListingItemsTab,
  type RemovedListingRow,
} from "@/components/admin/AdminRemovedListingItemsTab";
import {
  AdminShopWatchTab,
  type ShopWatchDetail,
  type ShopWatchRow,
} from "@/components/admin/AdminShopWatchTab";
import { AdminHomeHotCarouselFeaturedPanel } from "@/components/admin/AdminHomeHotCarouselFeaturedPanel";
import { AdminPopularItemsFeaturedPanel } from "@/components/admin/AdminPopularItemsFeaturedPanel";
import { AdminBrowseShopsPageFeaturedPanel } from "@/components/admin/AdminBrowseShopsPageFeaturedPanel";
import {
  listingRejectionReasonTextForCard,
  resolveListingRejectionNoticeBody,
} from "@/lib/shop-listing-rejection-notice";
import { AdminListTab } from "@/components/admin/AdminListTab";
import {
  AdminSupportMessagesTab,
  type AdminSupportThreadDetail,
  type AdminSupportThreadListRow,
} from "@/components/admin/AdminSupportMessagesTab";
import { Suspense } from "react";
import { AdminEmailFormatTab } from "@/components/admin/AdminEmailFormatTab";
import { AdminAnnouncementsTab } from "@/components/admin/AdminAnnouncementsTab";
import { AdminCronJobsTab } from "@/components/admin/AdminCronJobsTab";
import {
  AdminDigestEmailPreviewLoader,
  AdminDigestEmailPreviewSkeleton,
} from "@/components/admin/AdminDigestEmailPreviewLoader";
import { AdminShopFlairsTab } from "@/components/admin/AdminShopFlairsTab";
import {
  DEFAULT_ADMIN_SUMMARY_EMAIL_DTO,
  toAdminSummaryEmailSettingsDTO,
} from "@/lib/admin-summary-email-settings-dto";
import { AdminInboxTab, type AdminInboxRow } from "@/components/admin/AdminInboxTab";
import {
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
  PLATFORM_SHOP_SLUG,
  SPECIAL_PROMOTION_FREE_LISTING_IDS,
} from "@/lib/marketplace-constants";
import { adminInboxEmailAddress } from "@/lib/admin-inbox-config";
import {
  HOME_HOT_CAROUSEL_MAX_ITEMS,
  SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS,
} from "@/lib/platform-all-page-featured-constants";
import {
  getOrderedHotFeaturedItemProductIds,
  getOrderedPopularFeaturedItemProductIds,
} from "@/lib/platform-all-page-featured";
import { getFeaturedShopsRankedRows } from "@/lib/shops-browse-page-featured";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";
import { shopListingPrintifyMappingReservedWhere } from "@/lib/shop-listing-printify-mapping-reserved";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";
import { loadSupportUnresolvedShopIdsForAdmin } from "@/lib/admin-nav-badges";
import { listingOrdinalByListingId } from "@/lib/shop-listing-ordinal";
import {
  fetchPrintifyCatalog,
  hasPrintifyApiToken,
  PRINTIFY_ADMIN_FETCH_TIMEOUT_MS,
} from "@/lib/printify";
import { defaultPrintifyVariantIdForCatalogProduct } from "@/lib/printify-catalog";
import { listingRejectionNoticeDetail } from "@/lib/listing-request-reject-reasons";
import {
  adminCreateTagForm,
  adminDeleteTagForm,
  adminUpdateTagForm,
} from "@/actions/admin-tags";
import {
  AdminModerationKeywordsTab,
  type AdminModerationKeywordRow,
  type AdminModerationKeywordSpotlightRow,
} from "@/components/admin/AdminModerationKeywordsTab";
import { AdminShopFreeListingsTab } from "@/components/admin/AdminShopFreeListingsTab";
import {
  loadAdminShopSlugPickerOptions,
  loadAdminShopsWithBonusFreeListingSlots,
} from "@/actions/admin-shop-free-listings";
import {
  loadModerationKeywordAdminRows,
  loadModerationKeywordPhrases,
  moderationMatchesForListingRequestRow,
} from "@/lib/moderation-keyword-scan";
import { formatDisplayedDateTime } from "@/lib/format-display-datetime";
import { CRON_JOB_REFERENCE_ROWS } from "@/lib/cron-jobs-reference";

import type { AdminDashboardSection } from "./admin-dashboard";

export type AdminDashboardTabPanelProps = {
  adminSection: AdminDashboardSection;
  inventoryTab: string;
  sp: Record<string, string | string[] | undefined>;
};

export function AdminDashboardTabPanelFallback() {
  return (
    <div className="animate-pulse space-y-4" aria-busy aria-label="Loading tab content">
      <div className="h-5 w-48 rounded bg-zinc-800/80" />
      <div className="h-32 rounded-lg bg-zinc-900/50" />
      <div className="h-24 rounded-lg bg-zinc-900/40" />
    </div>
  );
}

function platformSalesUtcMonthTitles(reference: Date): {
  currentMonthTitle: string;
  previousMonthTitle: string;
} {
  const fmt = (y: number, m: number) =>
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m, 1)),
    );
  const cy = reference.getUTCFullYear();
  const cm = reference.getUTCMonth();
  const pm = cm === 0 ? 11 : cm - 1;
  const py = cm === 0 ? cy - 1 : cy;
  return {
    currentMonthTitle: fmt(cy, cm),
    previousMonthTitle: fmt(py, pm),
  };
}

type AdminProductWithTags = Prisma.ProductGetPayload<{
  include: { primaryTag: true; tags: { include: { tag: true } } };
}>;

type AdminListingRequestShopListing = Prisma.ShopListingGetPayload<{
  include: {
    shop: {
      select: {
        displayName: true;
        slug: true;
        listingFeeBonusFreeSlots: true;
        welcomeMessage: true;
        socialLinks: true;
      };
    };
    product: {
      select: {
        id: true;
        name: true;
        slug: true;
        fulfillmentType: true;
        imageUrl: true;
        imageGallery: true;
      };
    };
  };
}>;

type AdminRemovedShopListingLoaded = Prisma.ShopListingGetPayload<{
  include: {
    shop: true;
    product: {
      select: {
        id: true;
        name: true;
        slug: true;
        fulfillmentType: true;
        imageUrl: true;
        imageGallery: true;
      };
    };
  };
}>;

function buildListingRequestTabRowsFromLoaded(
  listingRequestRows: AdminListingRequestShopListing[],
  listingOrdinalById: Map<string, number>,
  moderationPhrases: readonly string[],
): ListingRequestTabRow[] {
  return listingRequestRows
    .map((r) => ({
      id: r.id,
      shopId: r.shopId,
      active: r.active,
      adminRemovedFromShopAt: r.adminRemovedFromShopAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
      requestStatus: r.requestStatus,
      requestItemName: r.requestItemName,
      storefrontItemBlurb: r.storefrontItemBlurb,
      listingSearchKeywords: r.listingSearchKeywords,
      requestImages: r.requestImages,
      listingPrintifyProductId: r.listingPrintifyProductId,
      listingPrintifyVariantId: r.listingPrintifyVariantId,
      listingPrintifyCatalogSyncedAt: r.listingPrintifyCatalogSyncedAt?.toISOString() ?? null,
      listingFeePaidAt: r.listingFeePaidAt?.toISOString() ?? null,
      listingOrdinal: listingOrdinalById.get(r.id) ?? 1,
      adminListingSecondaryImageUrl: r.adminListingSecondaryImageUrl,
      moderationMatchSummary: moderationMatchesForListingRequestRow(
        {
          requestItemName: r.requestItemName,
          storefrontItemBlurb: r.storefrontItemBlurb,
          listingSearchKeywords: r.listingSearchKeywords,
          shop: {
            displayName: r.shop.displayName,
            welcomeMessage: r.shop.welcomeMessage,
            socialLinks: r.shop.socialLinks,
          },
        },
        moderationPhrases,
      ),
      shop: {
        displayName: r.shop.displayName,
        slug: r.shop.slug,
        listingFeeBonusFreeSlots: r.shop.listingFeeBonusFreeSlots,
      },
      product: r.product,
    }))
    .filter((r) => {
      if (r.requestStatus !== ListingRequestStatus.approved) return true;
      if (r.shop.slug === PLATFORM_SHOP_SLUG) return false;
      const fee = listingFeeCentsForOrdinal(
        r.listingOrdinal,
        r.shop.slug,
        r.shop.listingFeeBonusFreeSlots ?? 0,
      );
      if (r.listingFeePaidAt != null || fee === 0) return false;
      return true;
    });
}

export async function AdminDashboardTabPanel(props: AdminDashboardTabPanelProps) {
  const { adminSection, inventoryTab, sp } = props;

  if (!inventoryTab) return null;

  const supportShopParam =
    typeof sp.supportShop === "string" && sp.supportShop.trim() ? sp.supportShop.trim() : undefined;
  const watchShopParam =
    typeof sp.watchShop === "string" && sp.watchShop.trim() ? sp.watchShop.trim() : undefined;

  const publicBaseTrim = publicAppBaseUrl()?.replace(/\/$/, "") ?? "";
  const adminInboxWebhookEndpoint = publicBaseTrim
    ? `${publicBaseTrim}/api/webhooks/resend-inbound`
    : null;

  const siteEmailTemplateRows =
    adminSection === "backend" && inventoryTab === "email-format"
      ? await prisma.siteEmailTemplate.findMany({
          where: {
            key: {
              in: [
                "shop_dashboard_email_verification",
                "shop_dashboard_password_reset",
                "shop_dashboard_account_deletion_confirm",
                "shop_dashboard_two_factor_confirm_device",
                "gift_creator_redemption_codes",
                "shop_inactivity_deactivation_warning",
              ],
            },
          },
        })
      : [];

  const emailFormatTabEntries =
    adminSection === "backend" && inventoryTab === "email-format"
      ? buildAdminEmailFormatEntries(siteEmailTemplateRows, emailLinkOrigin())
      : [];

  const emailFormatSendPreviews =
    adminSection === "backend" && inventoryTab === "email-format"
      ? await loadSiteEmailSendPreviewsForAdmin(emailLinkOrigin())
      : null;

  const summaryEmailSettingsDto =
    adminSection === "backend" && inventoryTab === "email-format"
      ? await prisma.adminSummaryEmailSettings.findUnique({ where: { id: "default" } }).then((row) =>
          row ? toAdminSummaryEmailSettingsDTO(row) : DEFAULT_ADMIN_SUMMARY_EMAIL_DTO,
        )
      : DEFAULT_ADMIN_SUMMARY_EMAIL_DTO;

  const adminInboundDelegate = prismaAdminInboundEmailOrNull();

  const adminInboxRowsLoaded: AdminInboxRow[] =
    adminSection === "main" && inventoryTab === "admin-inbox" && adminInboundDelegate
      ? (
          await adminInboundDelegate.findMany({
            orderBy: { receivedAt: "desc" },
            take: 200,
          })
        ).map((r) => ({
          id: r.id,
          resendEmailId: r.resendEmailId,
          fromAddress: r.fromAddress,
          toAddress: r.toAddress,
          subject: r.subject,
          textBody: r.textBody,
          htmlBody: r.htmlBody,
          receivedAt: r.receivedAt.toISOString(),
        }))
      : [];

  const salesFromRaw = typeof sp.salesFrom === "string" ? sp.salesFrom : "";
  const salesToRaw = typeof sp.salesTo === "string" ? sp.salesTo : "";
  const salesKindRaw = typeof sp.salesKind === "string" ? sp.salesKind.trim() : "";
  const salesKindFilter: "all" | "listing" | "item" | "support" | "promotion" =
    salesKindRaw === "listing" ||
    salesKindRaw === "item" ||
    salesKindRaw === "support" ||
    salesKindRaw === "promotion"
      ? salesKindRaw
      : "all";
  function parseIsoDateBoundary(s: string): Date | undefined {
    const t = s.trim();
    if (!t) return undefined;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const salesFrom = parseIsoDateBoundary(salesFromRaw);
  const salesTo = parseIsoDateBoundary(salesToRaw);
  const salesOrderCreatedAt =
    salesFrom || salesTo
      ? {
          ...(salesFrom ? { gte: salesFrom } : {}),
          ...(salesTo ? { lte: salesTo } : {}),
        }
      : undefined;

  /** Queue rows for listing-requests tab (full rows only load on the Requests tab). */
  const listingRequestTabPrismaWhere: Prisma.ShopListingWhereInput = {
    removedFromListingRequestsAt: null,
    requestStatus: {
      in: [
        ListingRequestStatus.submitted,
        ListingRequestStatus.images_ok,
        ListingRequestStatus.printify_item_created,
        ListingRequestStatus.approved,
      ],
    },
  };

  const bugFeedbackRows: AdminBugFeedbackRow[] =
    adminSection === "main" && inventoryTab === "bug-feedback"
      ? (
          await prisma.bugFeedbackReport.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
            include: {
              shop: { select: { slug: true, displayName: true } },
            },
          })
        ).map((r) => ({
          id: r.id,
          shop: r.shop,
          happened: r.happened,
          expected: r.expected,
          stepsToReproduce: r.stepsToReproduce,
          pageUrl: r.pageUrl,
          userAgent: r.userAgent,
          imageUrl: r.imageUrl,
          createdAtIso: r.createdAt.toISOString(),
          resolvedAtIso: r.resolvedAt?.toISOString() ?? null,
          adminNotes: r.adminNotes,
        }))
      : [];

  const sync = typeof sp.sync === "string" ? sp.sync : undefined;
  const syncUpdated = typeof sp.updated === "string" ? sp.updated : undefined;
  const syncCreated = typeof sp.created === "string" ? sp.created : undefined;
  const syncSkipped = typeof sp.skipped === "string" ? sp.skipped : undefined;
  const syncRemoved = typeof sp.removed === "string" ? sp.removed : undefined;
  const syncReason = typeof sp.reason === "string" ? sp.reason : undefined;
  const syncMode = typeof sp.syncMode === "string" ? sp.syncMode : undefined;
  const fullSyncAtRaw = typeof sp.fullSyncAt === "string" ? sp.fullSyncAt : undefined;
  const fullSyncAt =
    fullSyncAtRaw != null
      ? (() => {
          try {
            return decodeURIComponent(fullSyncAtRaw);
          } catch {
            return fullSyncAtRaw;
          }
        })()
      : undefined;
  const tagErr = typeof sp.tag_err === "string" ? sp.tag_err : undefined;
  const saved = typeof sp.saved === "string" ? sp.saved : undefined;
  const listingQueryId =
    typeof sp.listing === "string" ? sp.listing : undefined;
  const tagSaved = typeof sp.tag_saved === "string" ? sp.tag_saved : undefined;
  const kwErr = typeof sp.kw_err === "string" ? sp.kw_err : undefined;
  const kwSaved = typeof sp.kw_saved === "string" ? sp.kw_saved : undefined;
  const flErr = typeof sp.fl_err === "string" ? sp.fl_err : undefined;
  const flSaved = sp.fl_saved === "1";
  const flShop = typeof sp.fl_shop === "string" ? sp.fl_shop : undefined;
  const flGranted = (() => {
    const n = Number.parseInt(typeof sp.fl_granted === "string" ? sp.fl_granted : "", 10);
    return Number.isFinite(n) ? n : undefined;
  })();
  const flTotalBonus = (() => {
    const n = Number.parseInt(typeof sp.fl_total_bonus === "string" ? sp.fl_total_bonus : "", 10);
    return Number.isFinite(n) ? n : undefined;
  })();
  const flTotalCap = (() => {
    const n = Number.parseInt(typeof sp.fl_total_cap === "string" ? sp.fl_total_cap : "", 10);
    return Number.isFinite(n) ? n : undefined;
  })();
  const savedTagId =
    typeof sp.saved_tag_id === "string" ? sp.saved_tag_id : undefined;
  const pfyHook = typeof sp.pfyHook === "string" ? sp.pfyHook : undefined;
  const pfyHookReason = typeof sp.pfyHookReason === "string" ? sp.pfyHookReason : undefined;
  const pfyHookDetail = typeof sp.pfyHookDetail === "string" ? sp.pfyHookDetail : undefined;
  const pub = typeof sp.pub === "string" ? sp.pub : undefined;
  const pubKind = typeof sp.pubKind === "string" ? sp.pubKind : undefined;
  const pubPid = typeof sp.pubPid === "string" ? sp.pubPid : undefined;
  const pubReason = typeof sp.pubReason === "string" ? sp.pubReason : undefined;
  const pubDetail = typeof sp.pubDetail === "string" ? sp.pubDetail : undefined;
  const r2Prune = typeof sp.r2Prune === "string" ? sp.r2Prune : undefined;
  const r2PruneReason =
    typeof sp.r2PruneReason === "string" ? sp.r2PruneReason : undefined;
  const r2Listed = typeof sp.r2Listed === "string" ? sp.r2Listed : undefined;
  const r2Ref = typeof sp.r2Ref === "string" ? sp.r2Ref : undefined;
  const r2Orphans = typeof sp.r2Orphans === "string" ? sp.r2Orphans : undefined;
  const r2Deleted = typeof sp.r2Deleted === "string" ? sp.r2Deleted : undefined;

  const printifyHookBanner =
    pfyHook === "ok"
      ? {
          variant: "ok" as const,
          text:
            pfyHookDetail === "already"
              ? "This storefront webhook is already registered with Printify."
              : "Registered the order webhook with Printify. They can POST events to your live URL.",
        }
      : pfyHook === "err"
        ? {
            variant: "err" as const,
            text:
              pfyHookReason === "no_shop"
                ? "Set PRINTIFY_SHOP_ID in the environment."
                : pfyHookReason === "no_secret"
                  ? "Set PRINTIFY_WEBHOOK_SECRET (at least 16 random characters) in the environment."
                  : pfyHookReason === "no_public_url"
                    ? "Set NEXT_PUBLIC_APP_URL to your live https origin (or deploy on Vercel so VERCEL_URL is available)."
                    : (() => {
                        try {
                          return decodeURIComponent(pfyHookReason ?? "Something went wrong.");
                        } catch {
                          return pfyHookReason ?? "Something went wrong.";
                        }
                      })(),
          }
        : undefined;

  const printifyPublishNotice =
    pub === "ok"
      ? {
          variant: "ok" as const,
          kind: pubKind === "failed" ? ("failed" as const) : ("succeeded" as const),
          productId: pubPid,
        }
      : pub === "err"
        ? {
            variant: "err" as const,
            reason: pubReason,
            productId: pubPid,
            detail: pubDetail
              ? (() => {
                  try {
                    return decodeURIComponent(pubDetail);
                  } catch {
                    return pubDetail;
                  }
                })()
              : undefined,
          }
        : undefined;

  const loadProducts =
    adminSection === "backend" &&
    (inventoryTab === "printify" || inventoryTab === "tags")
      ? prisma.product.findMany({
          orderBy: [{ name: "asc" }],
          include: {
            primaryTag: true,
            tags: { include: { tag: true } },
          },
        })
      : Promise.resolve([] as AdminProductWithTags[]);

  const loadRemovedRows =
    adminSection === "backend" && inventoryTab === "removed"
      ? prisma.shopListing.findMany({
          where: { removedFromListingRequestsAt: { not: null } },
          orderBy: { removedFromListingRequestsAt: "desc" },
          include: {
            shop: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                fulfillmentType: true,
                imageUrl: true,
                imageGallery: true,
              },
            },
          },
        })
      : Promise.resolve([] as AdminRemovedShopListingLoaded[]);

  const loadFlairTypes =
    adminSection === "backend" && inventoryTab === "flairs"
      ? prisma.shopFlairType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] })
      : Promise.resolve([] as { id: string; slug: string; label: string; sortOrder: number; active: boolean }[]);

  let platformSalesTabLines: AdminPlatformSalesMergedLine[] = [];
  let platformSalesMonthSummaries: {
    currentMonthTitle: string;
    previousMonthTitle: string;
    currentTotals: PlatformSalesPeriodTotals;
    previousTotals: PlatformSalesPeriodTotals;
    ytdTotals: PlatformSalesYtdTotals;
    priorCalendarYearTotals: PlatformSalesYtdTotals;
  } | null = null;

  const clearSalesHistoryEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_ADMIN_CLEAR_SALES_HISTORY?.trim() === "true";

  const [adminTags, products, removedListingRows, flairTypes] = await Promise.all([
    adminSection === "backend" && inventoryTab === "tags"
      ? prisma.tag.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    loadProducts,
    loadRemovedRows,
    loadFlairTypes,
  ]);

  if (adminSection === "main" && inventoryTab === "sales") {
    const bundle = await loadMergedPlatformSalesLines(prisma, {
      salesOrderCreatedAt,
    });
    const merged = bundle.lines;
    platformSalesTabLines =
      salesKindFilter === "all"
        ? merged
        : merged.filter((l) => l.platformSaleCategory === salesKindFilter);
    const salesClock = new Date();
    const titles = platformSalesUtcMonthTitles(salesClock);
    const [currentTotals, previousTotals, ytdTotals, priorCalendarYearTotals] = await Promise.all([
      loadPlatformSalesCurrentMonthTotals(prisma, salesClock),
      loadPlatformSalesPreviousMonthTotals(prisma, salesClock),
      loadPlatformSalesYtdTotals(prisma, salesClock),
      loadPlatformSalesPriorCalendarYearTotals(prisma, salesClock),
    ]);
    platformSalesMonthSummaries = {
      ...titles,
      currentTotals,
      previousTotals,
      ytdTotals,
      priorCalendarYearTotals,
    };
  }

  /** Loaded only on the Shop leaderboard tab — cached aggregate over orders. */
  let shopLeaderboardRows: Awaited<ReturnType<typeof loadAdminShopLeaderboardRows>> = [];
  if (adminSection === "main" && inventoryTab === "shop-leaderboard") {
    shopLeaderboardRows = await loadAdminShopLeaderboardRows({
      salesFrom,
      salesTo,
    });
  }

  const removedListingTabRows: RemovedListingRow[] =
    adminSection === "backend" && inventoryTab === "removed"
      ? removedListingRows.map((r) => ({
          id: r.id,
          requestItemName: r.requestItemName,
          removedFromListingRequestsAt: r.removedFromListingRequestsAt?.toISOString() ?? null,
          adminListingRemovalNotes: r.adminListingRemovalNotes,
          shop: { displayName: r.shop.displayName, slug: r.shop.slug },
          product: {
            id: r.product.id,
            name: r.product.name,
            slug: r.product.slug,
            fulfillmentType: r.product.fulfillmentType,
          },
        }))
      : [];

  /** Requests tab rows (heavy); badge count is cached separately. */
  let listingRequestTabRows: ListingRequestTabRow[] = [];

  if (adminSection === "main" && inventoryTab === "requests") {
    const listingRequestRows = await prisma.shopListing.findMany({
      where: listingRequestTabPrismaWhere,
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        shop: {
          select: {
            displayName: true,
            slug: true,
            listingFeeBonusFreeSlots: true,
            welcomeMessage: true,
            socialLinks: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            fulfillmentType: true,
            imageUrl: true,
            imageGallery: true,
          },
        },
      },
    });
    const listingOrdinalById = await listingOrdinalByListingId(
      prisma,
      listingRequestRows.map((r) => r.id),
    );
    const moderationPhrases = await loadModerationKeywordPhrases(prisma);
    listingRequestTabRows = buildListingRequestTabRowsFromLoaded(
      listingRequestRows,
      listingOrdinalById,
      moderationPhrases,
    );
  }

  let moderationKeywordTabRows: AdminModerationKeywordRow[] = [];
  const moderationKeywordSpotlightRows: AdminModerationKeywordSpotlightRow[] = [];
  let moderationKeywordMigrationRequired = false;
  if (adminSection === "backend" && inventoryTab === "keyword-triggers") {
    const [phrases, keywordBank, sampleListings] = await Promise.all([
      loadModerationKeywordPhrases(prisma),
      loadModerationKeywordAdminRows(prisma),
      prisma.shopListing.findMany({
        where: { shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
        orderBy: { updatedAt: "desc" },
        take: 80,
        select: {
          id: true,
          requestItemName: true,
          storefrontItemBlurb: true,
          listingSearchKeywords: true,
          shop: {
            select: {
              displayName: true,
              slug: true,
              welcomeMessage: true,
              socialLinks: true,
            },
          },
        },
      }),
    ]);
    moderationKeywordMigrationRequired = keywordBank.migrationRequired;
    moderationKeywordTabRows = keywordBank.rows.map((k) => ({
      id: k.id,
      phrase: k.phrase,
      createdAtIso: formatDisplayedDateTime(k.createdAt),
    }));
    for (const row of sampleListings) {
      const matches = moderationMatchesForListingRequestRow(
        {
          requestItemName: row.requestItemName,
          storefrontItemBlurb: row.storefrontItemBlurb,
          listingSearchKeywords: row.listingSearchKeywords,
          shop: {
            displayName: row.shop.displayName,
            welcomeMessage: row.shop.welcomeMessage,
            socialLinks: row.shop.socialLinks,
          },
        },
        phrases,
      );
      if (matches.length === 0) continue;
      moderationKeywordSpotlightRows.push({
        listingId: row.id,
        shopSlug: row.shop.slug,
        shopDisplayName: row.shop.displayName,
        matches,
      });
      if (moderationKeywordSpotlightRows.length >= 30) break;
    }
  }

  const freeListingTabData =
    adminSection === "backend" && inventoryTab === "free-listings"
      ? await Promise.all([
          loadAdminShopsWithBonusFreeListingSlots(),
          loadAdminShopSlugPickerOptions(),
        ])
      : null;
  const freeListingGrantRows = freeListingTabData?.[0] ?? [];
  const freeListingShopPickerOptions = freeListingTabData?.[1] ?? [];

  const supplementImagePendingWhere = {
    ownerSupplementPendingImageUrl: { not: null },
    requestStatus: ListingRequestStatus.approved,
    creatorRemovedFromShopAt: null,
    adminRemovedFromShopAt: null,
    shop: { slug: { not: PLATFORM_SHOP_SLUG } },
  };

  const supplementPendingTabRows = await (async () => {
    if (!(adminSection === "main" && inventoryTab === "custom-images")) return [];

    const rawRows = await prisma.shopListing.findMany({
      where: supplementImagePendingWhere,
      // DB orderBy is the within-group ordering; we then partition in JS so listings
      // without a live custom image come first (newer ones still take priority).
      orderBy: [{ ownerSupplementPendingSubmittedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        shopId: true,
        requestItemName: true,
        ownerSupplementImageUrl: true,
        ownerSupplementPendingImageUrl: true,
        ownerSupplementPendingSubmittedAt: true,
        updatedAt: true,
        shop: { select: { displayName: true, slug: true } },
        product: { select: { name: true, slug: true } },
      },
    });

    const mapped = rawRows
      .filter((row) => Boolean(row.ownerSupplementPendingImageUrl?.trim()))
      .map((row) => ({
        id: row.id,
        shopId: row.shopId,
        requestItemName: row.requestItemName,
        ownerSupplementImageUrl: row.ownerSupplementImageUrl,
        ownerSupplementPendingImageUrl: row.ownerSupplementPendingImageUrl!.trim(),
        ownerSupplementPendingSubmittedAt:
          row.ownerSupplementPendingSubmittedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        shop: row.shop,
        product: row.product,
      }));

    const withoutLive = mapped.filter((r) => !r.ownerSupplementImageUrl?.trim());
    const withLive = mapped.filter((r) => Boolean(r.ownerSupplementImageUrl?.trim()));
    return [...withoutLive, ...withLive];
  })();

  let shopWatchRows: ShopWatchRow[] = [];
  let platformBrowseFeaturedPickerShops: { id: string; displayName: string }[] = [];
  let platformBrowseFeaturedPickerProductsByShopId: Record<
    string,
    { productId: string; label: string }[]
  > = {};
  let platformBrowseFeaturedPickerLabelsByProductId: Record<string, string> = {};
  let platformHomeHotCarouselInitialIds: string[] = [];
  let platformPopularItemsInitialIds: string[] = [];
  let platformBrowseShopsPageFeaturedInitialIds: string[] = [];
  let creatorShops: { id: string; displayName: string; slug: string; listingFeeBonusFreeSlots: number | null }[] = [];
  let creatorShopIds: string[] = [];

  if (inventoryTab === "shop-watch" || inventoryTab === "promotion-lists") {
    creatorShops = await prisma.shop.findMany({
      where: { slug: { not: PLATFORM_SHOP_SLUG }, active: true },
      select: { id: true, displayName: true, slug: true, listingFeeBonusFreeSlots: true },
      orderBy: { displayName: "asc" },
    });
    creatorShopIds = creatorShops.map((s) => s.id);
  }

  if (inventoryTab === "shop-watch" && creatorShopIds.length > 0) {
    const [paidOrderRows, allCreatorListings, listingRejectionNotices] = await Promise.all([
      prisma.order.findMany({
        where: {
          shopId: { in: creatorShopIds },
          status: OrderStatus.paid,
        },
        select: { shopId: true },
      }),
      prisma.shopListing.findMany({
        where: { shopId: { in: creatorShopIds } },
        select: {
          id: true,
          shopId: true,
          createdAt: true,
          listingFeePaidAt: true,
          active: true,
          requestStatus: true,
          requestItemName: true,
          requestImages: true,
          adminRemovedFromShopAt: true,
          creatorRemovedFromShopAt: true,
          removedFromListingRequestsAt: true,
          adminListingRemovalNotes: true,
          product: { select: { name: true, slug: true, active: true } },
        },
      }),
      prisma.shopOwnerNotice.findMany({
        where: { shopId: { in: creatorShopIds }, kind: "listing_rejected" },
        orderBy: { createdAt: "desc" },
        select: { shopId: true, kind: true, relatedListingId: true, body: true },
      }),
    ]);

    const listingRejectionNoticesByShop = new Map<
      string,
      Array<{ kind: string; relatedListingId: string | null; body: string }>
    >();
    for (const n of listingRejectionNotices) {
      const arr = listingRejectionNoticesByShop.get(n.shopId) ?? [];
      arr.push(n);
      listingRejectionNoticesByShop.set(n.shopId, arr);
    }

    /** Same filters as the former `groupBy` on listings (avoids Prisma 7 aggregate edge cases). */
    const activeByShop = new Map<string, number>();
    const frozenByShop = new Map<string, number>();
    const removedByShop = new Map<string, number>();
    const salesByShop = new Map<string, number>();
    for (const id of creatorShopIds) {
      activeByShop.set(id, 0);
      frozenByShop.set(id, 0);
      removedByShop.set(id, 0);
      salesByShop.set(id, 0);
    }
    for (const l of allCreatorListings) {
      if (l.adminRemovedFromShopAt != null) {
        frozenByShop.set(l.shopId, (frozenByShop.get(l.shopId) ?? 0) + 1);
      }
      if (l.creatorRemovedFromShopAt != null) {
        removedByShop.set(l.shopId, (removedByShop.get(l.shopId) ?? 0) + 1);
      }
      if (
        l.active &&
        l.creatorRemovedFromShopAt == null &&
        l.product.active
      ) {
        activeByShop.set(l.shopId, (activeByShop.get(l.shopId) ?? 0) + 1);
      }
    }
    for (const o of paidOrderRows) {
      const sid = o.shopId;
      if (sid != null) {
        salesByShop.set(sid, (salesByShop.get(sid) ?? 0) + 1);
      }
    }

    const listingsByShop = new Map<string, typeof allCreatorListings>();
    for (const l of allCreatorListings) {
      const arr = listingsByShop.get(l.shopId) ?? [];
      arr.push(l);
      listingsByShop.set(l.shopId, arr);
    }

    const sortDetails = (a: ShopWatchDetail, b: ShopWatchDetail) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });

    const listingFeeKindForShopWatch = (
      shopSlug: string,
      ordinal1Based: number,
      listingId: string,
      listingFeePaidAt: Date | null,
      listingFeeBonusFreeSlots: number,
    ): ShopWatchDetail["listingFeeKind"] => {
      if (SPECIAL_PROMOTION_FREE_LISTING_IDS.has(listingId)) {
        return "free_promo";
      }
      const cents = listingFeeCentsForOrdinal(ordinal1Based, shopSlug, listingFeeBonusFreeSlots);
      if (cents === 0) {
        return isFounderUnlimitedFreeListingsShop(shopSlug) ? "free_promo" : "free_slot";
      }
      return listingFeePaidAt != null ? "paid" : "unpaid";
    };

    shopWatchRows = creatorShops.map((shop) => {
      const shopRejectionNotices = listingRejectionNoticesByShop.get(shop.id) ?? [];
      const listings = listingsByShop.get(shop.id) ?? [];
      const ordinalByListingId = new Map<string, number>();
      [...listings]
        .sort((a, b) => {
          const t = a.createdAt.getTime() - b.createdAt.getTime();
          if (t !== 0) return t;
          return a.id.localeCompare(b.id);
        })
        .forEach((row, i) => ordinalByListingId.set(row.id, i + 1));

      const detailsActiveRaw: ShopWatchDetail[] = [];
      const detailsFrozenRaw: ShopWatchDetail[] = [];
      const detailsRemovedRaw: ShopWatchDetail[] = [];
      const detailsOtherPipelineRaw: ShopWatchDetail[] = [];
      const detailsOtherRequestedRaw: ShopWatchDetail[] = [];
      const detailsOtherApprovedRaw: ShopWatchDetail[] = [];
      const detailsOtherRejectedRaw: ShopWatchDetail[] = [];

      for (const l of listings) {
        const ordinal = ordinalByListingId.get(l.id) ?? 1;
        const listingFeeKind = listingFeeKindForShopWatch(
          shop.slug,
          ordinal,
          l.id,
          l.listingFeePaidAt,
          shop.listingFeeBonusFreeSlots ?? 0,
        );
        const base: Omit<ShopWatchDetail, "rowKind"> = {
          listingId: l.id,
          productName: l.product.name,
          productSlug: l.product.slug,
          listingFeeKind,
          queueRemoved: l.removedFromListingRequestsAt != null,
          notes: l.adminListingRemovalNotes,
        };
        if (l.creatorRemovedFromShopAt != null) {
          detailsRemovedRaw.push({
            ...base,
            rowKind: "removed",
            removalSource: "creator",
          });
        } else if (l.adminRemovedFromShopAt != null) {
          detailsFrozenRaw.push({ ...base, rowKind: "frozen" });
        } else if (l.active && l.creatorRemovedFromShopAt == null && l.product.active) {
          detailsActiveRaw.push({ ...base, rowKind: "active" });
        } else if (
          l.removedFromListingRequestsAt != null &&
          l.creatorRemovedFromShopAt == null &&
          l.adminRemovedFromShopAt == null
        ) {
          detailsRemovedRaw.push({
            ...base,
            rowKind: "removed",
            removalSource: "admin_queue",
            rejectionReasonText: listingRejectionNoticeDetail("other", null),
          });
        } else {
          const row: ShopWatchDetail = {
            ...base,
            rowKind: "other",
            pipelineStatus: l.requestStatus,
            listingActive: l.active,
            productActive: l.product.active,
          };
          if (l.requestStatus === ListingRequestStatus.rejected) {
            const noticeBody = resolveListingRejectionNoticeBody(
              shopRejectionNotices,
              l.id,
              l.product.name,
            );
            detailsOtherRejectedRaw.push({
              ...row,
              rejectionReasonText: listingRejectionReasonTextForCard(noticeBody),
            });
          } else if (l.requestStatus === ListingRequestStatus.approved) {
            detailsOtherApprovedRaw.push(row);
          } else if (
            l.requestStatus === ListingRequestStatus.submitted ||
            l.requestStatus === ListingRequestStatus.images_ok
          ) {
            detailsOtherRequestedRaw.push(row);
          } else {
            detailsOtherPipelineRaw.push(row);
          }
        }
      }

      detailsActiveRaw.sort(sortDetails);
      detailsFrozenRaw.sort(sortDetails);
      detailsRemovedRaw.sort(sortDetails);
      detailsOtherRequestedRaw.sort(sortDetails);
      detailsOtherPipelineRaw.sort(sortDetails);
      detailsOtherApprovedRaw.sort(sortDetails);
      detailsOtherRejectedRaw.sort(sortDetails);

      const detailsActive = detailsActiveRaw;
      const detailsFrozen = detailsFrozenRaw;
      const detailsRemoved = detailsRemovedRaw;
      const detailsOtherPipeline = detailsOtherPipelineRaw;
      const detailsOtherRequested = detailsOtherRequestedRaw;
      const detailsOtherApproved = detailsOtherApprovedRaw;
      const detailsOtherRejected = detailsOtherRejectedRaw;

      const paidListingsCount = listings.reduce((acc, l) => {
        const ordinal = ordinalByListingId.get(l.id) ?? 1;
        return (
          listingFeeKindForShopWatch(
            shop.slug,
            ordinal,
            l.id,
            l.listingFeePaidAt,
            shop.listingFeeBonusFreeSlots ?? 0,
          ) === "paid"
        )
          ? acc + 1
          : acc;
      }, 0);

      return {
        shopId: shop.id,
        displayName: shop.displayName,
        slug: shop.slug,
        activeListingsCount:
          (activeByShop.get(shop.id) ?? 0) + detailsOtherApproved.length,
        salesCount: salesByShop.get(shop.id) ?? 0,
        paidListingsCount,
        frozenCount: frozenByShop.get(shop.id) ?? 0,
        removedCount: detailsRemoved.length + detailsOtherRejected.length,
        detailsActive,
        detailsFrozen,
        detailsRemoved,
        detailsOtherRequested,
        detailsOtherPipeline,
        detailsOtherApproved,
        detailsOtherRejected,
      };
    });
    shopWatchRows.sort(
      (a, b) =>
        b.frozenCount + b.removedCount - (a.frozenCount + a.removedCount) ||
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );
  }

  /** Hot carousel + browse featured pickers — Promotion lists tab only (Shop Data does not need this). */
  if (inventoryTab === "promotion-lists") {
    try {
      const platformShop = await prisma.shop.findUnique({
        where: { slug: PLATFORM_SHOP_SLUG },
        select: { id: true },
      });
      if (platformShop) {
        try {
          const featuredRow = await prisma.shop.findUnique({
            where: { id: platformShop.id },
            select: {
              homeHotCarouselFeaturedProductIds: true,
              popularItemsFeaturedProductIds: true,
              browseShopsPageFeaturedShopIds: true,
            },
          });
          platformHomeHotCarouselInitialIds = parseShopOrderedFeaturedProductIds(
            featuredRow?.homeHotCarouselFeaturedProductIds ?? null,
            { max: HOME_HOT_CAROUSEL_MAX_ITEMS },
          );
          if (platformHomeHotCarouselInitialIds.length === 0) {
            platformHomeHotCarouselInitialIds = await getOrderedHotFeaturedItemProductIds();
          }
          platformPopularItemsInitialIds = parseShopOrderedFeaturedProductIds(
            featuredRow?.popularItemsFeaturedProductIds ?? null,
            { max: HOME_HOT_CAROUSEL_MAX_ITEMS },
          );
          if (platformPopularItemsInitialIds.length === 0) {
            platformPopularItemsInitialIds = await getOrderedPopularFeaturedItemProductIds();
          }
          platformBrowseShopsPageFeaturedInitialIds = parseShopOrderedFeaturedProductIds(
            featuredRow?.browseShopsPageFeaturedShopIds ?? null,
            { max: SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS },
          );
          if (platformBrowseShopsPageFeaturedInitialIds.length === 0) {
            const ranked = await getFeaturedShopsRankedRows(SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS);
            platformBrowseShopsPageFeaturedInitialIds = ranked.map((r) => r.id);
          }
        } catch (e) {
          console.warn(
            "[admin-dashboard] platform featured JSON columns unavailable (apply migrations for browse-all / home hot carousel?)",
            e,
          );
        }
        const liveRows = await prisma.shopListing.findMany({
          where: {
            ...marketplaceAggregatedListingWhere,
            product: { active: true },
          },
          select: {
            shopId: true,
            productId: true,
            requestItemName: true,
            product: { select: { name: true } },
            shop: { select: { displayName: true } },
          },
          orderBy: { product: { name: "asc" } },
          take: 500,
        });
        const byShop = new Map<string, { productId: string; label: string }[]>();
        const shopDisplayNameById = new Map<string, string>();
        for (const r of liveRows) {
          shopDisplayNameById.set(r.shopId, r.shop.displayName);
          const itemLabel = r.requestItemName?.trim() || r.product.name;
          const list = byShop.get(r.shopId) ?? [];
          if (list.some((x) => x.productId === r.productId)) continue;
          list.push({ productId: r.productId, label: itemLabel });
          byShop.set(r.shopId, list);
        }
        platformBrowseFeaturedPickerShops = [...shopDisplayNameById.entries()]
          .map(([id, displayName]) => ({ id, displayName }))
          .sort((a, b) =>
            a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
          );
        platformBrowseFeaturedPickerProductsByShopId = {};
        platformBrowseFeaturedPickerLabelsByProductId = {};
        for (const [sid, products] of byShop) {
          platformBrowseFeaturedPickerProductsByShopId[sid] = [...products].sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
          );
          for (const p of products) {
            platformBrowseFeaturedPickerLabelsByProductId[p.productId] = p.label;
          }
        }
      }
    } catch (e) {
      console.error("[admin-dashboard] promotion-lists featured panel load", e);
    }
  }

  let creatorAccountCount = 0;
  let shopsWithListingCount = 0;
  let shopsWithPaidListingCount = 0;
  if (inventoryTab === "shop-watch") {
    const counts = await Promise.all([
      prisma.shopUser.count({
        where: { shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
      }),
      prisma.shop.count({
        where: {
          slug: { not: PLATFORM_SHOP_SLUG },
          listings: { some: {} },
        },
      }),
      prisma.shop.count({
        where: {
          slug: { not: PLATFORM_SHOP_SLUG },
          listings: { some: { listingFeePaidAt: { not: null } } },
        },
      }),
    ]);
    creatorAccountCount = counts[0];
    shopsWithListingCount = counts[1];
    shopsWithPaidListingCount = counts[2];
  }

  const printifyProducts = products;

  /** Live Printify shop catalog (Printify + Requests tabs only — avoids slow remote fetch on every admin load). */
  let printifyCatalogPickList: {
    id: string;
    title: string;
    defaultVariantId: string | null;
  }[] = [];
  const printifyShopIdEnv = process.env.PRINTIFY_SHOP_ID?.trim() ?? "";
  if (
    hasPrintifyApiToken() &&
    printifyShopIdEnv &&
    ((adminSection === "main" && inventoryTab === "requests") ||
      (adminSection === "backend" && inventoryTab === "printify"))
  ) {
    try {
      const catalog = await fetchPrintifyCatalog(printifyShopIdEnv, {
        timeoutMs: PRINTIFY_ADMIN_FETCH_TIMEOUT_MS,
      });
      printifyCatalogPickList = [...catalog]
        .map((p) => ({
          id: p.id.trim(),
          title: p.title.trim() || p.id,
          defaultVariantId: defaultPrintifyVariantIdForCatalogProduct(p),
          catalogUpdatedAt: p.updatedAt?.getTime() ?? 0,
        }))
        .filter((p) => p.id.length > 0)
        .sort((a, b) => b.catalogUpdatedAt - a.catalogUpdatedAt);
    } catch {
      printifyCatalogPickList = [];
    }
  }

  let printifyProductIdsMappedToShopListings: string[] = [];
  /** Printify catalog product ids referenced by more than one shop listing (review warning). */
  let printifyProductIdsSharedAcrossListings: string[] = [];
  if (inventoryTab === "requests") {
    try {
      const mappedShopListingPrintifyRows = await prisma.shopListing.findMany({
        where: shopListingPrintifyMappingReservedWhere,
        select: { listingPrintifyProductId: true },
      });
      const trimmedIds = mappedShopListingPrintifyRows
        .map((row) => row.listingPrintifyProductId?.trim())
        .filter((id): id is string => Boolean(id));
      printifyProductIdsMappedToShopListings = [...new Set(trimmedIds)];
      const counts = new Map<string, number>();
      for (const id of trimmedIds) counts.set(id, (counts.get(id) ?? 0) + 1);
      printifyProductIdsSharedAcrossListings = [...counts.entries()]
        .filter(([, n]) => n >= 2)
        .map(([id]) => id);
    } catch (e) {
      console.error("[admin] printifyProductIdsMappedToShopListings query failed", e);
    }
  }

  let adminSupportThreads: AdminSupportThreadListRow[] = [];
  let adminSupportDetail: AdminSupportThreadDetail | null = null;

  if (inventoryTab === "support") {
    const [unresolvedShopIdList, threadsRaw] = await Promise.all([
      loadSupportUnresolvedShopIdsForAdmin(),
      prisma.supportThread.findMany({
        where: { shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: {
          shop: {
            select: {
              displayName: true,
              slug: true,
            },
          },
        },
      }),
    ]);
    const supportUnresolvedShopIds = new Set(unresolvedShopIdList);
    adminSupportThreads = threadsRaw.map((t) => ({
      shopId: t.shopId,
      shopDisplayName: t.shop.displayName,
      shopSlug: t.shop.slug,
      ownerEmail: "—",
      updatedAt: t.updatedAt.toISOString(),
      needsReply: supportUnresolvedShopIds.has(t.shopId),
    }));

    if (supportShopParam) {
      const shopRow = await prisma.shop.findFirst({
        where: { id: supportShopParam, slug: { not: PLATFORM_SHOP_SLUG } },
        select: {
          id: true,
          displayName: true,
          slug: true,
          users: { take: 1, orderBy: { createdAt: "asc" }, select: { email: true } },
        },
      });
      if (shopRow) {
        const existingThread = await prisma.supportThread.findUnique({
          where: { shopId: shopRow.id },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        adminSupportDetail = {
          shopId: shopRow.id,
          shopDisplayName: shopRow.displayName,
          shopSlug: shopRow.slug,
          ownerEmail: shopRow.users[0]?.email ?? "—",
          needsReply: supportUnresolvedShopIds.has(shopRow.id),
          resolvedAtIso: existingThread?.resolvedAt?.toISOString() ?? null,
          messages:
            existingThread?.messages.map((m) => ({
              id: m.id,
              authorRole: m.authorRole as "creator" | "admin",
              body: m.body,
              createdAt: m.createdAt.toISOString(),
            })) ?? [],
        };
      }
    }
  }

  return (
    <>
          {adminSection === "main" ? (
            inventoryTab === "support" ? (
            <AdminSupportMessagesTab
              threads={adminSupportThreads}
              detail={adminSupportDetail}
              selectedShopId={supportShopParam}
            />
          ) : inventoryTab === "custom-images" ? (
            <AdminListingSupplementImageRequestsTab rows={supplementPendingTabRows} />
          ) : inventoryTab === "bug-feedback" ? (
            <AdminBugFeedbackTab rows={bugFeedbackRows} />
          ) : inventoryTab === "requests" ? (
            <AdminListingRequestsTab
              rows={listingRequestTabRows}
              printifyCatalogPickList={printifyCatalogPickList}
              printifyProductIdsMappedToShopListings={printifyProductIdsMappedToShopListings}
              printifyProductIdsSharedAcrossListings={printifyProductIdsSharedAcrossListings}
              r2Configured={isR2UploadConfigured()}
            />
          ) : inventoryTab === "promotion-lists" ? (
            <>
              <AdminHomeHotCarouselFeaturedPanel
                key={`home-hot:${JSON.stringify(platformHomeHotCarouselInitialIds)}`}
                shops={platformBrowseFeaturedPickerShops}
                productsByShopId={platformBrowseFeaturedPickerProductsByShopId}
                labelsByProductId={platformBrowseFeaturedPickerLabelsByProductId}
                initialProductIds={platformHomeHotCarouselInitialIds}
              />
              <AdminPopularItemsFeaturedPanel
                key={`popular-items:${JSON.stringify(platformPopularItemsInitialIds)}`}
                shops={platformBrowseFeaturedPickerShops}
                productsByShopId={platformBrowseFeaturedPickerProductsByShopId}
                labelsByProductId={platformBrowseFeaturedPickerLabelsByProductId}
                initialProductIds={platformPopularItemsInitialIds}
              />
              <AdminBrowseShopsPageFeaturedPanel
                key={`browse-shops:${JSON.stringify(platformBrowseShopsPageFeaturedInitialIds)}`}
                shops={creatorShops}
                initialShopIds={platformBrowseShopsPageFeaturedInitialIds}
              />
            </>
          ) : inventoryTab === "shop-watch" ? (
            <AdminShopWatchTab
              rows={shopWatchRows}
              marketplaceStats={{
                creatorAccountCount,
                shopsWithListingCount,
                shopsWithPaidListingCount,
              }}
              initialExpandedShopId={watchShopParam}
            />
          ) : inventoryTab === "shop-leaderboard" ? (
            <AdminShopLeaderboardTab
              rows={shopLeaderboardRows}
              salesFromValue={salesFromRaw}
              salesToValue={salesToRaw}
            />
          ) : inventoryTab === "sales" ? (
            <AdminPlatformSalesTab
              lines={platformSalesTabLines}
              salesFromValue={salesFromRaw}
              salesToValue={salesToRaw}
              salesKind={salesKindFilter}
              monthSummaries={platformSalesMonthSummaries}
              clearSalesHistoryEnabled={clearSalesHistoryEnabled}
            />
          ) : inventoryTab === "admin-inbox" ? (
            <AdminInboxTab
              rows={adminInboxRowsLoaded}
              inboxAddress={adminInboxEmailAddress()}
              webhookEndpoint={adminInboxWebhookEndpoint}
            />
          ) : null)
          : (
            inventoryTab === "admin-list" ? (
            <AdminListTab />
          ) : inventoryTab === "printify" ? (
            <PrintifyInventoryTab
              products={printifyProducts}
              allTags={adminTags}
              sync={sync}
              syncMode={syncMode}
              fullSyncAtIso={fullSyncAt}
              syncUpdated={syncUpdated}
              syncCreated={syncCreated}
              syncSkipped={syncSkipped}
              syncRemoved={syncRemoved}
              syncReason={syncReason}
              openListingId={listingQueryId}
              listingSavedId={
                saved === "product" ? listingQueryId : undefined
              }
              publishNotice={printifyPublishNotice}
              r2PruneNotice={
                r2Prune === "preview" && r2Listed !== undefined
                  ? {
                      variant: "preview",
                      listed: parseInt(r2Listed, 10) || 0,
                      referenced: parseInt(r2Ref ?? "0", 10) || 0,
                      orphans: parseInt(r2Orphans ?? "0", 10) || 0,
                    }
                  : r2Prune === "ok" && r2Listed !== undefined
                    ? {
                        variant: "ok",
                        listed: parseInt(r2Listed, 10) || 0,
                        referenced: parseInt(r2Ref ?? "0", 10) || 0,
                        orphans: parseInt(r2Orphans ?? "0", 10) || 0,
                        deleted: parseInt(r2Deleted ?? "0", 10) || 0,
                      }
                    : r2Prune === "err"
                      ? {
                          variant: "err",
                          reason: r2PruneReason ?? "Unknown error.",
                        }
                      : undefined
              }
            />
          ) : inventoryTab === "removed" ? (
            <AdminRemovedListingItemsTab rows={removedListingTabRows} />
          ) : inventoryTab === "announcements" ? (
            <AdminAnnouncementsTab />
          ) : inventoryTab === "email-format" ? (
            <AdminEmailFormatTab
              entries={emailFormatTabEntries}
              sendPreviewsByKey={emailFormatSendPreviews}
              summaryEmail={summaryEmailSettingsDto}
            >
              <Suspense fallback={<AdminDigestEmailPreviewSkeleton />}>
                <AdminDigestEmailPreviewLoader frequency={summaryEmailSettingsDto.frequency} />
              </Suspense>
            </AdminEmailFormatTab>
          ) : inventoryTab === "cron-jobs" ? (
            <AdminCronJobsTab rows={CRON_JOB_REFERENCE_ROWS} />
          ) : inventoryTab === "flairs" ? (
            <AdminShopFlairsTab types={flairTypes} />
          ) : inventoryTab === "keyword-triggers" ? (
            <AdminModerationKeywordsTab
              rows={moderationKeywordTabRows}
              spotlightRows={moderationKeywordSpotlightRows}
              migrationRequired={moderationKeywordMigrationRequired}
              kwErr={kwErr}
              kwSaved={kwSaved}
            />
          ) : inventoryTab === "free-listings" ? (
            <AdminShopFreeListingsTab
              grantRows={freeListingGrantRows}
              shopPickerOptions={freeListingShopPickerOptions}
              flErr={flErr}
              flSaved={flSaved}
              flShop={flShop}
              flGranted={flGranted}
              flTotalBonus={flTotalBonus}
              flTotalCap={flTotalCap}
            />
          ) : inventoryTab === "tags" ? (
            <section id="tags" aria-label="Shop tags">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                Shop tags
              </h2>
              {tagSaved === "created" ||
              tagSaved === "updated" ||
              tagSaved === "deleted" ? (
                <p
                  role="status"
                  className="mt-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
                >
                  {tagSaved === "created"
                    ? "Tag created."
                    : tagSaved === "updated"
                      ? "Tag saved."
                      : "Tag deleted."}
                </p>
              ) : null}
              {tagErr ? (
                <p className="mt-2 rounded border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-200/90">
                  {tagErr}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-600">
                Tags are shared across the shop. Optional: set a “By Item” top pick per tag below.
              </p>
              <ul className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
                {adminTags.map((t) => {
                  const effectiveSpotlightId = t.byItemSpotlightProductId;
                  const byItemSpotlightDefault =
                    effectiveSpotlightId &&
                    products.some(
                      (p) =>
                        p.id === effectiveSpotlightId && productHasTag(p, t.id),
                    )
                      ? effectiveSpotlightId
                      : "__auto__";
                  return (
                  <li
                    key={t.id}
                    className="flex flex-col gap-3 py-3 text-zinc-300 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
                  >
                    <form
                      action={adminUpdateTagForm}
                      className="flex min-w-0 flex-1 flex-col gap-2"
                    >
                      <input type="hidden" name="tagId" value={t.id} />
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="block text-[11px] text-zinc-500">
                          Name
                          <input
                            type="text"
                            name="name"
                            required
                            defaultValue={t.name}
                            className="mt-0.5 block w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 sm:w-40"
                          />
                        </label>
                        <label className="block text-[11px] text-zinc-500">
                          Slug
                          <input
                            type="text"
                            name="slug"
                            defaultValue={t.slug}
                            className="mt-0.5 block w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 sm:w-36"
                          />
                        </label>
                        <label className="block text-[11px] text-zinc-500">
                          Sort
                          <input
                            type="number"
                            name="sortOrder"
                            defaultValue={t.sortOrder}
                            className="mt-0.5 block w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                          />
                        </label>
                        <button
                          type="submit"
                          className={
                            tagSaved === "updated" && savedTagId === t.id
                              ? "rounded border border-emerald-600/70 bg-emerald-950/45 px-2.5 py-1 text-[11px] font-medium text-emerald-100/95 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]"
                              : "rounded border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                          }
                          aria-label={
                            tagSaved === "updated" && savedTagId === t.id
                              ? "Tag saved"
                              : "Save tag"
                          }
                        >
                          {tagSaved === "updated" && savedTagId === t.id
                            ? "Saved"
                            : "Save"}
                        </button>
                      </div>
                      <div className="flex w-full min-w-0 max-w-full flex-col gap-1.5 sm:max-w-[min(100%,32rem)]">
                        <label className="block text-[11px] text-zinc-500">
                          By Item top pick
                          <select
                            name="byItemSpotlightProductId"
                            defaultValue={byItemSpotlightDefault}
                            className="mt-0.5 block max-w-[min(100%,20rem)] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                            title="Which product represents this tag in the By Item browse (must have this tag)."
                          >
                            <option value="__auto__">Auto (first A–Z)</option>
                            {products
                              .filter((p) => productHasTag(p, t.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                    </form>
                    <div className="flex shrink-0 items-center gap-3 sm:pb-0.5">
                      <ConfirmDeleteForm
                        action={adminDeleteTagForm}
                        message={`Delete tag “${t.name}”? Only if no products use it.`}
                      >
                        <input type="hidden" name="tagId" value={t.id} />
                        <button
                          type="submit"
                          className="text-[11px] text-blue-400/90 hover:underline"
                        >
                          Delete
                        </button>
                      </ConfirmDeleteForm>
                    </div>
                  </li>
                  );
                })}
              </ul>
              {adminTags.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600">No tags — run db seed.</p>
              ) : null}
              <form
                action={adminCreateTagForm}
                className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <label className="block text-xs text-zinc-500">
                  Name
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 block w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Slug (optional)
                  <input
                    type="text"
                    name="slug"
                    className="mt-1 block w-36 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Sort
                  <input
                    type="number"
                    name="sortOrder"
                    defaultValue={99}
                    className="mt-1 block w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700"
                >
                  Add tag
                </button>
              </form>
            </section>
          ) : inventoryTab === "printify-api" ? (
            <PrintifyApiTab hookBanner={printifyHookBanner} />
          ) : null
          )}

    </>
  );
}
