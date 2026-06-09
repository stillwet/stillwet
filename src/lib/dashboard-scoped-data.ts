import type { Prisma } from "@/generated/prisma/client";
import {
  ListingRequestStatus,
  OrderStatus,
  PromotionKind,
  PromotionPurchaseStatus,
  ShopFlairPurchaseStatus,
  ShopGoogleShoppingPurchaseStatus,
  SupportMessageAuthor,
} from "@/generated/prisma/enums";
import { getPromotionCreditBalancesForShop } from "@/lib/promotion-credit-balance";
import { prisma } from "@/lib/prisma";
import {
  promotionStripePaymentsAvailable,
  promotionUiUsesMockCheckout,
} from "@/lib/checkout-mock";
import { buildGroupedListingSectionsForDashboard } from "@/lib/dashboard-legacy-baseline-listing-groups";
import {
  sanitizeShopListingAdminSecondaryImageUrlForDisplay,
  sanitizeShopListingOwnerSupplementImageUrlForDisplay,
  sanitizeShopListingOwnerSupplementPendingImageUrlForDisplay,
} from "@/lib/r2-upload";
import { ensureBaselineAdminCatalogIfEmpty } from "@/lib/seed-baseline-admin-catalog";
import { buildShopBaselineCatalogGroups } from "@/lib/shop-baseline-catalog";
import {
  loadAdminBaselineCatalogRows,
  loadAdminSecretMenuCatalogRows,
} from "@/lib/admin-baseline-catalog-rows";
import {
  shopHasSecretMenuAccess,
  sortExtendedCatalogGroups,
} from "@/lib/secret-menu-catalog";
import { listingRejectionReasonTextForCard, resolveListingRejectionNoticeBody } from "@/lib/shop-listing-rejection-notice";
import {
  resolveCatalogPrefillFromBaselinePickEncoded,
  resolveCatalogPrefillFromStubProductSlug,
  type DraftListingRequestPrefillPayload,
} from "@/lib/shop-baseline-draft-prefill";
import {
  buildPlacementPeriodChoices,
  countHotAndTopShopPaidSlotsThreePeriodsBatch,
  countPromotionKindPaidSlotsThreePeriods,
  type CappedPlacementPeriodOfferWithCounts,
  resolveHotItemPlacementOfferWithCounts,
  resolvePopularPlacementOfferWithCounts,
  resolveTopShopPlacementOfferWithCounts,
} from "@/lib/promotion-hot-item-policy";
import {
  HOT_ITEM_PLATFORM_PERIOD_CAP,
  POPULAR_ITEM_PLATFORM_PERIOD_CAP,
  TOP_SHOP_PLATFORM_PERIOD_CAP,
  isPaidPromotionActiveNow,
  promotionEffectiveEndUtc,
  promotionEffectiveStartUtc,
} from "@/lib/promotion-policy-shared";
import {
  currentListingPromotionPeriodStartUtc,
  formatPacificPromotionWindowMmDdRange,
  getPromotionPeriodIndexContaining,
  promotionPeriodStartUtc,
} from "@/lib/promotion-period-pacific";
import { promotionPriceCentsForKind } from "@/lib/promotions";
import {
  type AdminCatalogRowForDisplay,
  dashboardPaidOrderLineDisplayLabel,
  listingGoodsServicesUnitCents,
} from "@/lib/dashboard-payload-helpers";
import {
  readShopPromotionsDashboardSnapshot,
  writeShopPromotionsDashboardSnapshot,
} from "@/lib/shop-promotions-dashboard-snapshot";
import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";
import {
  type DashboardPromotionPurchaseRow,
  type PromotionMonthlySlotUi,
} from "@/lib/promotion-dashboard-ui-types";
import type { DashboardListingRow, DashboardPaidOrderRow, DashboardNoticeRow } from "@/components/dashboard/DashboardMainTabs";
import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import type { GroupedDashboardListing } from "@/lib/dashboard-legacy-baseline-listing-groups";
import { loadModerationKeywordPhrases } from "@/lib/moderation-keyword-scan";
import { loadPaidOrdersForShopDashboard } from "@/lib/load-paid-orders-for-shop-dashboard";
import {
  loadUnpaidPublicationFeeListings,
  type UnpaidPublicationFeeListingRow,
} from "@/lib/listing-fee-unpaid-rows";
import {
  freeListingRequestSlotsSummary,
  type FreeListingRequestSlotsSummary,
} from "@/lib/marketplace-constants";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";
import { SHOP_FLAIR_PURCHASE_HISTORY_KIND } from "@/lib/shop-flair";
import { SHOP_GOOGLE_SHOPPING_PURCHASE_HISTORY_KIND } from "@/lib/shop-google-shopping";

export type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";

export type DashboardScope =
  | "listingsBody"
  | "promotionsBody"
  | "ordersBody"
  | "notificationsBody"
  | "supportBody"
  | "requestListingCatalog";

export type {
  DashboardPromotionsTabSummaryPayload,
  PromotionPurchaseLifecycle,
  PromotionPurchaseSummaryRow,
} from "@/lib/dashboard-promotions-tab-types";
export type { PromotionCheckoutSlotsByKind } from "@/lib/dashboard-promotions-payload-types";
import type {
  DashboardPromotionsTabSummaryPayload,
  PromotionPurchaseLifecycle,
  PromotionPurchaseSummaryRow,
} from "@/lib/dashboard-promotions-tab-types";
import type { PromotionCheckoutSlotsByKind } from "@/lib/dashboard-promotions-payload-types";

type DashboardGroupedListingSections = {
  live: GroupedDashboardListing<DashboardListingRow>[];
  request: GroupedDashboardListing<DashboardListingRow>[];
  removed: GroupedDashboardListing<DashboardListingRow>[];
};

export type DashboardSupportChatPayload = {
  messages: { id: string; authorRole: "creator" | "admin"; body: string; createdAt: string }[];
  resolvedAtIso: string | null;
};

type ShopWithListings = Prisma.ShopGetPayload<{
  include: {
    listings: {
      orderBy: { updatedAt: "desc" };
      include: { product: true };
    };
  };
}>;

type OrderLineForDash = Prisma.OrderGetPayload<{
  select: {
    id: true;
    createdAt: true;
    lines: {
      select: {
        productName: true;
        quantity: true;
        unitPriceCents: true;
        goodsServicesCostCents: true;
        platformCutCents: true;
        shopCutCents: true;
        printifyVariantId: true;
        shopListing: { select: { baselineCatalogPickEncoded: true; requestItemName: true } };
        product: { select: { name: true } };
      };
    };
  };
}>;

/** Live listings eligible for listing-targeted promotions (minimal DB read). */
export async function loadLiveListingPicklistForShop(
  shopId: string,
): Promise<{ id: string; label: string }[]> {
  const minimal = await prisma.shopListing.findMany({
    where: { shopId },
    select: {
      id: true,
      active: true,
      requestStatus: true,
      requestItemName: true,
      product: { select: { name: true } },
    },
  });
  return minimal
    .filter((l) => l.active && l.requestStatus !== ListingRequestStatus.rejected)
    .map((l) => ({
      id: l.id,
      label: (l.requestItemName && l.requestItemName.trim()) || l.product.name,
    }));
}

function promotionPurchaseLifecycle(row: {
  status: PromotionPurchaseStatus;
  eligibleFrom: Date | null;
  paidAt: Date | null;
}): PromotionPurchaseLifecycle {
  if (row.status === PromotionPurchaseStatus.pending) return "pending_payment";
  if (row.status !== PromotionPurchaseStatus.paid || !row.paidAt) return "other";
  if (isPaidPromotionActiveNow(row)) return "active";
  const start = promotionEffectiveStartUtc(row);
  const end = promotionEffectiveEndUtc(row);
  const now = new Date();
  if (start && now < start) return "scheduled";
  if (end && now > end) return "expired";
  return "expired";
}

function shopFlairPurchaseLifecycle(row: {
  status: ShopFlairPurchaseStatus;
  paidAt: Date | null;
}): PromotionPurchaseLifecycle {
  if (row.status === ShopFlairPurchaseStatus.pending) return "pending_payment";
  if (row.status === ShopFlairPurchaseStatus.paid && row.paidAt) return "active";
  return "other";
}

function shopGoogleShoppingPurchaseLifecycle(row: {
  status: ShopGoogleShoppingPurchaseStatus;
  paidAt: Date | null;
}): PromotionPurchaseLifecycle {
  if (row.status === ShopGoogleShoppingPurchaseStatus.pending) return "pending_payment";
  if (row.status === ShopGoogleShoppingPurchaseStatus.paid && row.paidAt) return "active";
  return "other";
}

async function loadPromotionsSummaryForShopLive(
  shopId: string,
  shopSlug?: string,
): Promise<DashboardPromotionsTabSummaryPayload> {
  const t0 = Date.now();
  const mockPromotionCheckout =
    shopSlug && shopSlug.trim().length > 0
      ? promotionUiUsesMockCheckout(shopSlug)
      : !promotionStripePaymentsAvailable();
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;

  /** Two-step read: avoids nested `PromotionPurchase → ShopListing → Product` join (often slower on Postgres / serverless pools). */
  const [rows, flairRows, googleShoppingRows] = await Promise.all([
    prisma.promotionPurchase.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        kind: true,
        status: true,
        amountCents: true,
        createdAt: true,
        paidAt: true,
        eligibleFrom: true,
        shopListingId: true,
        transactionNumber: true,
      },
    }),
    prisma.shopFlairPurchase.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        amountCents: true,
        createdAt: true,
        paidAt: true,
        transactionNumber: true,
      },
    }),
    prisma.shopGoogleShoppingPurchase.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        amountCents: true,
        createdAt: true,
        paidAt: true,
        packId: true,
        creditsGranted: true,
        transactionNumber: true,
      },
    }),
  ]);

  const listingIds = [...new Set(rows.map((r) => r.shopListingId).filter((id): id is string => id != null && id !== ""))];
  const listingsById =
    listingIds.length === 0
      ? new Map<
          string,
          { requestItemName: string | null; product: { name: string } }
        >()
      : new Map(
          (
            await prisma.shopListing.findMany({
              where: { shopId, id: { in: listingIds } },
              select: {
                id: true,
                requestItemName: true,
                product: { select: { name: true } },
              },
            })
          ).map((l) => [
            l.id,
            {
              requestItemName: l.requestItemName,
              product: l.product,
            },
          ]),
        );

  const promotionPurchases: PromotionPurchaseSummaryRow[] = rows.map((row) => {
    const sl =
      row.shopListingId === null ? null : listingsById.get(row.shopListingId) ?? null;
    const activeWindowPacificRange =
      row.paidAt && row.status === PromotionPurchaseStatus.paid
        ? formatPacificPromotionWindowMmDdRange({
            eligibleFrom: row.eligibleFrom,
            paidAt: row.paidAt,
          })
        : null;
    const expiresAtIso =
      row.paidAt && row.status === PromotionPurchaseStatus.paid
        ? promotionEffectiveEndUtc({ eligibleFrom: row.eligibleFrom, paidAt: row.paidAt })?.toISOString() ?? null
        : null;
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      amountCents: row.amountCents,
      createdAtIso: row.createdAt.toISOString(),
      paidAtIso: row.paidAt?.toISOString() ?? null,
      expiresAtIso,
      eligibleFromIso: row.eligibleFrom?.toISOString() ?? null,
      activeWindowPacificRange,
      listingLabel: sl ? sl.requestItemName?.trim() || sl.product.name : null,
      transactionNumber: row.transactionNumber,
      lifecycle: promotionPurchaseLifecycle({
        status: row.status,
        eligibleFrom: row.eligibleFrom,
        paidAt: row.paidAt,
      }),
      purchaseType: "promotion",
    };
  });

  const flairPurchases: PromotionPurchaseSummaryRow[] = flairRows.map((row) => ({
    id: row.id,
    kind: SHOP_FLAIR_PURCHASE_HISTORY_KIND,
    status: row.status,
    amountCents: row.amountCents,
    createdAtIso: row.createdAt.toISOString(),
    paidAtIso: row.paidAt?.toISOString() ?? null,
    expiresAtIso: null,
    eligibleFromIso: null,
    activeWindowPacificRange: null,
    listingLabel: null,
    transactionNumber: row.transactionNumber,
    lifecycle: shopFlairPurchaseLifecycle(row),
    purchaseType: "shop_flair",
  }));

  const googleShoppingPurchases: PromotionPurchaseSummaryRow[] = googleShoppingRows.map((row) => ({
    id: row.id,
    kind: SHOP_GOOGLE_SHOPPING_PURCHASE_HISTORY_KIND,
    status: row.status,
    amountCents: row.amountCents,
    createdAtIso: row.createdAt.toISOString(),
    paidAtIso: row.paidAt?.toISOString() ?? null,
    expiresAtIso: null,
    eligibleFromIso: null,
    activeWindowPacificRange: null,
    listingLabel: null,
    lifecycle: shopGoogleShoppingPurchaseLifecycle(row),
    purchaseType: "shop_google_shopping",
    googleShoppingPackId: row.packId,
    googleShoppingCreditsGranted: row.creditsGranted,
    transactionNumber: row.transactionNumber,
  }));

  const purchases = [...promotionPurchases, ...flairPurchases, ...googleShoppingPurchases]
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    .slice(0, 40);

  const promotionCreditBalances = await getPromotionCreditBalancesForShop(shopId);

  const totalMs = Date.now() - t0;
  if (process.env.NODE_ENV === "production" && totalMs >= 3000) {
    console.warn("[loadPromotionsSummaryForShop] slow", { shopId, totalMs, rowCount: rows.length });
  } else if (process.env.NODE_ENV === "development" && totalMs >= 1000) {
    console.warn("[loadPromotionsSummaryForShop]", { shopId, totalMs, rowCount: rows.length });
  }

  return { purchases, mockPromotionCheckout, stripePublishableKey, promotionCreditBalances };
}

export async function rebuildShopPromotionsDashboardSnapshot(
  shopId: string,
  shopSlug?: string,
): Promise<void> {
  const live = await loadPromotionsSummaryForShopLive(shopId, shopSlug);
  await writeShopPromotionsDashboardSnapshot(shopId, live);
}

/**
 * Snapshot-first read for the Promotions tab (Option A).
 * Falls back to live compute and backfills the snapshot opportunistically.
 */
export async function loadPromotionsSummaryForShop(
  shopId: string,
  shopSlug?: string,
): Promise<DashboardPromotionsTabSummaryPayload> {
  const snapshot = await readShopPromotionsDashboardSnapshot(shopId);
  if (snapshot.ok) return snapshot.payload;

  const live = await loadPromotionsSummaryForShopLive(shopId, shopSlug);
  void writeShopPromotionsDashboardSnapshot(shopId, live).catch((e) => {
    console.warn("[promotionsSnapshot] backfill failed", e);
  });
  return live;
}

function promotionMonthlySlotUiFromCappedCounts(
  baseCents: number,
  periodCap: number,
  r: CappedPlacementPeriodOfferWithCounts,
  currentPlacementIdx: number,
  nowForOffers: Date,
): PromotionMonthlySlotUi {
  const periodStartUtc = currentListingPromotionPeriodStartUtc(new Date());
  const periodIndex = r.periodStarts.findIndex((d) => d.getTime() === periodStartUtc.getTime());
  const slotsUsedUtcThisMonth =
    periodIndex >= 0 ? r.filledCounts[periodIndex as 0 | 1 | 2] : 0;
  const periodChoices = buildPlacementPeriodChoices(
    baseCents,
    periodCap,
    r.filledCounts,
    r.periodStarts,
    currentPlacementIdx,
    nowForOffers,
  );
  const offerResolved = r.offer;
  return {
    monthlyCap: periodCap,
    slotsUsedUtcThisMonth,
    periodChoices,
    offerError: offerResolved && "error" in offerResolved ? offerResolved.error : null,
    offer:
      offerResolved && !("error" in offerResolved)
        ? {
            amountCents: offerResolved.amountCents,
            eligibleFromIso: offerResolved.eligibleFrom.toISOString(),
            isDeferred: offerResolved.futurePeriodOffset > 0,
            isSecondFuturePeriod: offerResolved.isSecondFuturePeriod,
            isProrated: offerResolved.isProrated,
            placementMonthLabel: offerResolved.placementPeriodLabel,
          }
        : null,
  };
}

async function buildPromotionSlotUiForKind(
  kind: PlacementCheckoutPromotionKind,
  filledCounts: [number, number, number],
  placementPeriodStarts: [Date, Date, Date],
  nowForOffers: Date,
  currentPlacementIdx: number,
): Promise<PromotionMonthlySlotUi> {
  if (kind === PromotionKind.HOT_FEATURED_ITEM) {
    const baseCents = promotionPriceCentsForKind(PromotionKind.HOT_FEATURED_ITEM);
    const r = await resolveHotItemPlacementOfferWithCounts(baseCents, nowForOffers, filledCounts);
    return promotionMonthlySlotUiFromCappedCounts(
      baseCents,
      HOT_ITEM_PLATFORM_PERIOD_CAP,
      r,
      currentPlacementIdx,
      nowForOffers,
    );
  }
  if (kind === PromotionKind.FEATURED_SHOP_HOME) {
    const baseCents = promotionPriceCentsForKind(PromotionKind.FEATURED_SHOP_HOME);
    const r = await resolveTopShopPlacementOfferWithCounts(baseCents, nowForOffers, filledCounts);
    return promotionMonthlySlotUiFromCappedCounts(
      baseCents,
      TOP_SHOP_PLATFORM_PERIOD_CAP,
      r,
      currentPlacementIdx,
      nowForOffers,
    );
  }
  const baseCents = promotionPriceCentsForKind(PromotionKind.MOST_POPULAR_OF_TAG_ITEM);
  const r = await resolvePopularPlacementOfferWithCounts(baseCents, nowForOffers, filledCounts);
  return promotionMonthlySlotUiFromCappedCounts(
    baseCents,
    POPULAR_ITEM_PLATFORM_PERIOD_CAP,
    r,
    currentPlacementIdx,
    nowForOffers,
  );
}

let promotionCheckoutSlotsInflight: Promise<PromotionCheckoutSlotsByKind> | null = null;

/** Platform slot counts + pricing for all dashboard checkout kinds (one DB round-trip, deduped). */
export function loadPromotionCheckoutSlotsByKind(): Promise<PromotionCheckoutSlotsByKind> {
  if (!promotionCheckoutSlotsInflight) {
    promotionCheckoutSlotsInflight = loadPromotionCheckoutSlotsByKindInner().finally(() => {
      promotionCheckoutSlotsInflight = null;
    });
  }
  return promotionCheckoutSlotsInflight;
}

async function loadPromotionCheckoutSlotsByKindInner(): Promise<PromotionCheckoutSlotsByKind> {
  const t0 = Date.now();
  const nowForOffers = new Date();
  const currentPlacementIdx = getPromotionPeriodIndexContaining(nowForOffers);
  const placementPeriodStarts = [0, 1, 2].map((o) =>
    promotionPeriodStartUtc(currentPlacementIdx + o),
  ) as [Date, Date, Date];

  const batch = await countHotAndTopShopPaidSlotsThreePeriodsBatch(placementPeriodStarts);
  const hotCounts = batch.hot;
  const topCounts = batch.top;
  const popularCounts = batch.popular;

  const [featuredShop, hotItem, popularItem] = await Promise.all([
    buildPromotionSlotUiForKind(
      PromotionKind.FEATURED_SHOP_HOME,
      topCounts,
      placementPeriodStarts,
      nowForOffers,
      currentPlacementIdx,
    ),
    buildPromotionSlotUiForKind(
      PromotionKind.HOT_FEATURED_ITEM,
      hotCounts,
      placementPeriodStarts,
      nowForOffers,
      currentPlacementIdx,
    ),
    buildPromotionSlotUiForKind(
      PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
      popularCounts,
      placementPeriodStarts,
      nowForOffers,
      currentPlacementIdx,
    ),
  ]);

  const totalMs = Date.now() - t0;
  if (totalMs >= 2000) {
    console.warn("[loadPromotionCheckoutSlotsByKind] slow", { totalMs });
  }

  return {
    [PromotionKind.FEATURED_SHOP_HOME]: featuredShop,
    [PromotionKind.HOT_FEATURED_ITEM]: hotItem,
    [PromotionKind.MOST_POPULAR_OF_TAG_ITEM]: popularItem,
  };
}

/**
 * Slot counts + pricing for one promotion kind — server action / API fallback when tab preload missing.
 */
export async function loadPromotionCheckoutSlotUiForKind(
  kind: PromotionKind,
  shopSlug: string,
): Promise<{
  slotUi: PromotionMonthlySlotUi;
  mockPromotionCheckout: boolean;
  stripePublishableKey: string | null;
}> {
  if (
    kind !== PromotionKind.HOT_FEATURED_ITEM &&
    kind !== PromotionKind.FEATURED_SHOP_HOME &&
    kind !== PromotionKind.MOST_POPULAR_OF_TAG_ITEM
  ) {
    throw new Error("Unsupported promotion kind for checkout.");
  }

  const mockPromotionCheckoutFlag = promotionUiUsesMockCheckout(shopSlug);
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;
  const nowForOffers = new Date();
  const currentPlacementIdx = getPromotionPeriodIndexContaining(nowForOffers);
  const placementPeriodStarts = [0, 1, 2].map((o) =>
    promotionPeriodStartUtc(currentPlacementIdx + o),
  ) as [Date, Date, Date];

  const filledCounts = await countPromotionKindPaidSlotsThreePeriods(kind, placementPeriodStarts);
  const slotUi = await buildPromotionSlotUiForKind(
    kind,
    filledCounts,
    placementPeriodStarts,
    nowForOffers,
    currentPlacementIdx,
  );

  return {
    slotUi,
    mockPromotionCheckout: mockPromotionCheckoutFlag,
    stripePublishableKey,
  };
}

/**
 * Server RSC no longer loads tab bodies; client fetches per tab on first open.
 * @deprecated Tab data loads via `/api/dashboard/*` from {@link DashboardMainTabs}.
 */
export function scopesForInitialTab(
  _tab: DashboardMainTabId,
  _isPlatform: boolean,
): DashboardScope[] {
  return [];
}

/** Client tab API: listings panel payload. */
export async function loadDashboardListingsTab(shopId: string, shopSlug: string) {
  return loadDashboardScopedChunks(shopId, false, ["listingsBody"], { shopSlug });
}

/** Client tab API: notifications panel payload. */
export async function loadDashboardNotificationsTab(shopId: string, shopSlug: string) {
  return loadDashboardScopedChunks(shopId, false, ["notificationsBody"], {
    shopSlug,
    skipModerationKeywords: true,
  });
}

/** Client tab API: support chat payload. */
export async function loadDashboardSupportTab(shopId: string, shopSlug: string) {
  return loadDashboardScopedChunks(shopId, false, ["supportBody"], {
    shopSlug,
    skipModerationKeywords: true,
  });
}

/** Client tab API: request listing catalog payload. */
export async function loadDashboardRequestListingTab(shopId: string, shopSlug: string) {
  return loadDashboardScopedChunks(shopId, false, ["requestListingCatalog"], { shopSlug });
}

/** Client tab API: platform shop listings + orders. */
export async function loadDashboardPlatformListingsTab(shopId: string) {
  return loadDashboardScopedChunks(shopId, true, ["listingsBody"], { skipModerationKeywords: true });
}

export async function loadDashboardPlatformOrdersTab(shopId: string) {
  return loadDashboardScopedChunks(shopId, true, ["ordersBody"], { skipModerationKeywords: true });
}

export async function loadBadgeCounts(shopId: string, isPlatform: boolean) {
  if (isPlatform) {
    return { notificationsUnread: 0, supportNewFromStaff: 0 };
  }
  const [notificationsUnread, supportThread] = await Promise.all([
    prisma.shopOwnerNotice.count({ where: { shopId, readAt: null } }),
    prisma.supportThread.findUnique({
      where: { shopId },
      select: { id: true },
    }),
  ]);
  let supportNewFromStaffCount = 0;
  if (supportThread) {
    const lastCreatorMsg = await prisma.supportMessage.findFirst({
      where: { threadId: supportThread.id, authorRole: SupportMessageAuthor.creator },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    supportNewFromStaffCount = await prisma.supportMessage.count({
      where: {
        threadId: supportThread.id,
        authorRole: SupportMessageAuthor.admin,
        ...(lastCreatorMsg ? { createdAt: { gt: lastCreatorMsg.createdAt } } : {}),
      },
    });
  }
  return { notificationsUnread, supportNewFromStaff: supportNewFromStaffCount };
}

export type LoadDashboardScopedChunksOptions = {
  /** Used for promotion mock/demo flags ({@link allowPromotionMockPay}). Pass creator shop slug when available. */
  shopSlug?: string;
  /** Promotions-only tab open: skip moderation keyword query so the shell resolves immediately. */
  skipModerationKeywords?: boolean;
};

export async function loadDashboardScopedChunks(
  shopId: string,
  isPlatform: boolean,
  scopes: DashboardScope[],
  options?: LoadDashboardScopedChunksOptions,
): Promise<{
  listingRows: DashboardListingRow[];
  groupedListingSections: DashboardGroupedListingSections;
  promotionsPayload: DashboardPromotionsTabSummaryPayload | null;
  paidOrders: DashboardPaidOrderRow[];
  notifications: { rows: DashboardNoticeRow[]; unreadCount: number } | null;
  supportChat: DashboardSupportChatPayload | null;
  requestListingCatalog: {
    catalogGroups: ShopSetupCatalogGroup[];
    extendedCatalogGroups: ShopSetupCatalogGroup[];
    draftListingRequestPrefill: DraftListingRequestPrefillPayload | null;
    adminCatalogItemCount: number;
    unpaidPublicationFeeListings: UnpaidPublicationFeeListingRow[];
    freeListingSlots: FreeListingRequestSlotsSummary;
  } | null;
  moderationKeywordPhrases: string[];
}> {
  const scopeSet = new Set(scopes);
  const needBaseline = scopeSet.has("listingsBody") || scopeSet.has("requestListingCatalog");
  if (needBaseline) {
    try {
      await ensureBaselineAdminCatalogIfEmpty(prisma);
    } catch (e) {
      console.error(
        "[loadDashboardScopedChunks] ensureBaselineAdminCatalogIfEmpty failed (check migrations / Product seed rows)",
        e,
      );
    }
  }

  const emptyGroups: DashboardGroupedListingSections = { live: [], request: [], removed: [] };

  const defaults = {
    listingRows: [] as DashboardListingRow[],
    groupedListingSections: emptyGroups,
    promotionsPayload: null as DashboardPromotionsTabSummaryPayload | null,
    paidOrders: [] as DashboardPaidOrderRow[],
    notifications: null as { rows: DashboardNoticeRow[]; unreadCount: number } | null,
    supportChat: null as DashboardSupportChatPayload | null,
    requestListingCatalog: null as {
      catalogGroups: ShopSetupCatalogGroup[];
      extendedCatalogGroups: ShopSetupCatalogGroup[];
      draftListingRequestPrefill: DraftListingRequestPrefillPayload | null;
      adminCatalogItemCount: number;
      unpaidPublicationFeeListings: UnpaidPublicationFeeListingRow[];
      freeListingSlots: FreeListingRequestSlotsSummary;
    } | null,
    moderationKeywordPhrases: [] as string[],
  };

  if (isPlatform && !scopeSet.has("listingsBody") && !scopeSet.has("ordersBody")) {
    return defaults;
  }

  let adminCatalogRows: Awaited<ReturnType<typeof loadAdminBaselineCatalogRows>> = [];

  if (!isPlatform && (scopeSet.has("listingsBody") || scopeSet.has("requestListingCatalog"))) {
    adminCatalogRows = await loadAdminBaselineCatalogRows();
  }

  const adminCatalogById = new Map<string, AdminCatalogRowForDisplay>(
    adminCatalogRows.map((r) => [r.id, { itemGoodsServicesCostCents: r.itemGoodsServicesCostCents }]),
  );

  let allOwnerNotices: Awaited<ReturnType<typeof prisma.shopOwnerNotice.findMany>> = [];
  if (!isPlatform && scopeSet.has("listingsBody")) {
    allOwnerNotices = await prisma.shopOwnerNotice.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        shopId: true,
        id: true,
        body: true,
        kind: true,
        createdAt: true,
        readAt: true,
        relatedListingId: true,
        relatedOrderId: true,
      },
    });
  }

  let shopFull: ShopWithListings | null = null;
  if (scopeSet.has("listingsBody")) {
    shopFull = await prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      include: {
        listings: {
          orderBy: { updatedAt: "desc" },
          include: { product: true },
        },
      },
    });
  }

  let listingRows: DashboardListingRow[] = [];
  let groupedListingSections: DashboardGroupedListingSections = emptyGroups;

  if (shopFull && scopeSet.has("listingsBody")) {
    const listingOrdinalById = (() => {
      const ordered = [...shopFull.listings].sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
      );
      return new Map(ordered.map((l, i) => [l.id, i + 1]));
    })();

    listingRows = shopFull.listings.map((listing) => {
      const rejectionNoticeBody =
        listing.requestStatus === ListingRequestStatus.rejected && !isPlatform
          ? resolveListingRejectionNoticeBody(
              allOwnerNotices,
              listing.id,
              listing.product.name,
            )
          : null;
      const rejectionReasonText = listingRejectionReasonTextForCard(rejectionNoticeBody);
      return {
        id: listing.id,
        active: listing.active,
        requestStatus: listing.requestStatus,
        priceCents: listing.priceCents,
        requestImages: listing.requestImages,
        adminListingSecondaryImageUrl: sanitizeShopListingAdminSecondaryImageUrlForDisplay(
          listing.adminListingSecondaryImageUrl,
          shopFull!.id,
          listing.id,
        ),
        ownerSupplementImageUrl: sanitizeShopListingOwnerSupplementImageUrlForDisplay(
          listing.ownerSupplementImageUrl,
          shopFull!.id,
          listing.id,
        ),
        ownerSupplementPendingImageUrl: sanitizeShopListingOwnerSupplementPendingImageUrlForDisplay(
          listing.ownerSupplementPendingImageUrl,
          shopFull!.id,
          listing.id,
        ),
        ownerSupplementPendingSubmittedAtIso:
          listing.ownerSupplementPendingSubmittedAt?.toISOString() ?? null,
        listingStorefrontCatalogImageUrls: listing.listingStorefrontCatalogImageUrls,
        baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
        goodsServicesUnitCents: listingGoodsServicesUnitCents(
          {
            baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
            product: listing.product,
          },
          adminCatalogById,
        ),
        listingPrintifyVariantId: listing.listingPrintifyVariantId,
        requestItemName: listing.requestItemName,
        storefrontItemBlurb: listing.storefrontItemBlurb,
        listingSearchKeywords: listing.listingSearchKeywords,
        listingFeePaidAt: listing.listingFeePaidAt?.toISOString() ?? null,
        adminRemovedFromShopAt: listing.adminRemovedFromShopAt?.toISOString() ?? null,
        creatorRemovedFromShopAt: listing.creatorRemovedFromShopAt?.toISOString() ?? null,
        listingOrdinal: listingOrdinalById.get(listing.id) ?? 1,
        updatedAtIso: listing.updatedAt.toISOString(),
        rejectionReasonText,
        product: {
          name: listing.product.name,
          slug: listing.product.slug,
          active: listing.product.active,
          minPriceCents: listing.product.minPriceCents,
          priceCents: listing.product.priceCents,
          imageUrl: listing.product.imageUrl,
          imageGallery: listing.product.imageGallery,
          fulfillmentType: listing.product.fulfillmentType,
          printifyVariantId: listing.product.printifyVariantId,
        },
      };
    });

    groupedListingSections = buildGroupedListingSectionsForDashboard(
      shopFull.id,
      listingRows,
      adminCatalogRows,
    );
  }

  const [
    promotionsPayload,
    paidOrders,
    notifications,
    supportChat,
    requestListingCatalog,
    moderationKeywordPhrases,
  ] = await Promise.all([
    !isPlatform && scopeSet.has("promotionsBody")
      ? loadPromotionsSummaryForShop(shopId, options?.shopSlug)
      : Promise.resolve(null as DashboardPromotionsTabSummaryPayload | null),
    (async (): Promise<DashboardPaidOrderRow[]> => {
      if (!scopeSet.has("ordersBody")) return [];
      const { orders } = await loadPaidOrdersForShopDashboard(shopId);
      return orders;
    })(),
    (async (): Promise<{
      rows: DashboardNoticeRow[];
      unreadCount: number;
    } | null> => {
      if (!isPlatform && scopeSet.has("notificationsBody")) {
        const rows = await prisma.shopOwnerNotice.findMany({
          where: { shopId },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            body: true,
            kind: true,
            createdAt: true,
            readAt: true,
            relatedListingId: true,
          },
        });
        const unreadCount = rows.filter((n) => n.readAt == null).length;
        return {
          rows: rows.map((n) => ({
            id: n.id,
            body: n.body,
            kind: n.kind,
            createdAt: n.createdAt.toISOString(),
            readAt: n.readAt?.toISOString() ?? null,
          })),
          unreadCount,
        };
      }
      return null;
    })(),
    (async (): Promise<DashboardSupportChatPayload | null> => {
      if (!isPlatform && scopeSet.has("supportBody")) {
        const supportThreadForPanel = await prisma.supportThread.findUnique({
          where: { shopId },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        return {
          messages:
            supportThreadForPanel?.messages.map((m) => ({
              id: m.id,
              authorRole: m.authorRole as "creator" | "admin",
              body: m.body,
              createdAt: m.createdAt.toISOString(),
            })) ?? [],
          resolvedAtIso: supportThreadForPanel?.resolvedAt?.toISOString() ?? null,
        };
      }
      return null;
    })(),
    (async (): Promise<{
      catalogGroups: ShopSetupCatalogGroup[];
      extendedCatalogGroups: ShopSetupCatalogGroup[];
      draftListingRequestPrefill: DraftListingRequestPrefillPayload | null;
      adminCatalogItemCount: number;
      unpaidPublicationFeeListings: UnpaidPublicationFeeListingRow[];
      freeListingSlots: FreeListingRequestSlotsSummary;
    } | null> => {
      if (!isPlatform && scopeSet.has("requestListingCatalog")) {
        const rows =
          adminCatalogRows.length > 0
            ? adminCatalogRows
            : await loadAdminBaselineCatalogRows();
        const catalogGroups = buildShopBaselineCatalogGroups(rows);

        const shopRow = await prisma.shop.findUnique({
          where: { id: shopId },
          select: {
            slug: true,
            listingFeeBonusFreeSlots: true,
            secretMenuAccessGrantedAt: true,
          },
        });

        let extendedCatalogGroups: ShopSetupCatalogGroup[] = [];
        let secretRows: Awaited<ReturnType<typeof loadAdminSecretMenuCatalogRows>> = [];
        if (shopRow && shopHasSecretMenuAccess(shopRow)) {
          secretRows = await loadAdminSecretMenuCatalogRows();
          extendedCatalogGroups = sortExtendedCatalogGroups(
            buildShopBaselineCatalogGroups(secretRows),
          );
        }

        const prefillRows = [...rows, ...secretRows];

        const draftListingForRequestPrefill = await prisma.shopListing.findFirst({
          where: {
            shopId,
            requestStatus: ListingRequestStatus.draft,
            active: false,
            creatorRemovedFromShopAt: null,
            adminRemovedFromShopAt: null,
          },
          include: { product: true },
        });

        let draftListingRequestPrefill: DraftListingRequestPrefillPayload | null = null;
        if (draftListingForRequestPrefill && prefillRows.length > 0) {
          const encoded = draftListingForRequestPrefill.baselineCatalogPickEncoded?.trim();
          const fromEncoded = encoded
            ? resolveCatalogPrefillFromBaselinePickEncoded(
                encoded,
                draftListingForRequestPrefill.priceCents,
                draftListingForRequestPrefill.requestItemName,
                prefillRows,
              )
            : null;
          const resolved =
            fromEncoded ??
            resolveCatalogPrefillFromStubProductSlug(
              shopId,
              draftListingForRequestPrefill.product.slug,
              draftListingForRequestPrefill.priceCents,
              draftListingForRequestPrefill.requestItemName,
              prefillRows,
            );
          if (resolved) {
            draftListingRequestPrefill = {
              listingId: draftListingForRequestPrefill.id,
              ...resolved,
              storefrontItemBlurb: draftListingForRequestPrefill.storefrontItemBlurb,
              listingSearchKeywords: draftListingForRequestPrefill.listingSearchKeywords,
            };
          }
        }

        const [unpaidPublicationFeeListings, nonDraftListingCount] = await Promise.all([
          loadUnpaidPublicationFeeListings(prisma, shopId),
          prisma.shopListing.count({
            where: { shopId, requestStatus: { not: ListingRequestStatus.draft } },
          }),
        ]);
        const freeListingSlots = freeListingRequestSlotsSummary(
          shopRow?.slug ?? "",
          shopRow?.listingFeeBonusFreeSlots ?? 0,
          nonDraftListingCount,
        );

        return {
          catalogGroups,
          extendedCatalogGroups,
          draftListingRequestPrefill,
          adminCatalogItemCount: rows.length + secretRows.length,
          unpaidPublicationFeeListings,
          freeListingSlots,
        };
      }
      return null;
    })(),
    !isPlatform && !options?.skipModerationKeywords
      ? loadModerationKeywordPhrases(prisma)
      : Promise.resolve([] as string[]),
  ]);

  return {
    listingRows,
    groupedListingSections,
    promotionsPayload,
    paidOrders,
    notifications,
    supportChat,
    requestListingCatalog,
    moderationKeywordPhrases,
  };
}
