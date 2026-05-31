import {
  BetaTesterOnboardingStatus,
  CreatorGiftCodeType,
  ListingRequestStatus,
  ShopUserRole,
} from "@/generated/prisma/enums";
import {
  computeShopOnboardingSteps,
  countIncompleteOnboardingSteps,
} from "@/lib/shop-onboarding-gate";
import { incompleteOnboardingStepLabels } from "@/lib/beta-tester-onboarding-sync";
import { prisma } from "@/lib/prisma";

export type AdminBetaTesterCodeRow = {
  codeId: string;
  code: string;
  createdAt: string;
  status: "unused" | "used";
  shopAccount: {
    shopId: string;
    slug: string;
    displayName: string;
    createdAt: string;
    adminFrozenAt: string | null;
  } | null;
  shopFreeze: {
    shopId: string;
    adminFrozenAt: string | null;
  } | null;
  onboardingStatus: BetaTesterOnboardingStatus | null;
  onboardingCompletedAt: string | null;
  incompleteSteps: string[];
};

export type AdminBetaTesterDashboardPayload = {
  codes: AdminBetaTesterCodeRow[];
};

const LISTING_PROGRESS_OR: Array<{
  requestStatus?: { in: ListingRequestStatus[] };
  active?: boolean;
}> = [
  { requestStatus: { in: [ListingRequestStatus.submitted] } },
  { requestStatus: { in: [ListingRequestStatus.images_ok] } },
  { requestStatus: { in: [ListingRequestStatus.printify_item_created] } },
  { requestStatus: { in: [ListingRequestStatus.approved] } },
  { active: true },
];

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

const redeemedShopSelect = {
  id: true,
  slug: true,
  displayName: true,
  betaTesterAt: true,
  betaTesterOnboardingStatus: true,
  betaTesterOnboardingCompletedAt: true,
  adminFrozenAt: true,
  itemGuidelinesAcknowledgedAt: true,
  connectChargesEnabled: true,
  payoutsEnabled: true,
  users: {
    where: { role: ShopUserRole.owner },
    select: { emailVerifiedAt: true },
    orderBy: { createdAt: "asc" as const },
    take: 1,
  },
} as const;

function unusedCodeRow(codeId: string, code: string, createdAt: Date): AdminBetaTesterCodeRow {
  return {
    codeId,
    code,
    createdAt: createdAt.toISOString(),
    status: "unused",
    shopAccount: null,
    shopFreeze: null,
    onboardingStatus: null,
    onboardingCompletedAt: null,
    incompleteSteps: [],
  };
}

export async function loadAdminBetaTesterDashboardPayload(): Promise<AdminBetaTesterDashboardPayload> {
  const codeRows = await prisma.creatorGiftCode.findMany({
    where: {
      type: CreatorGiftCodeType.shop_setup,
      purchase: { isBetaTesterBatch: true },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      createdAt: true,
      redeemedAt: true,
      redeemedByShopId: true,
      redeemedByShop: {
        select: redeemedShopSelect,
      },
    },
  });

  const redeemedShopIds = codeRows
    .map((row) => row.redeemedByShopId ?? row.redeemedByShop?.id)
    .filter((id): id is string => id != null);

  const [shopsWithListingProgress, shopsByIdRows] = await Promise.all([
    redeemedShopIds.length === 0
      ? Promise.resolve([])
      : prisma.shopListing.findMany({
          where: { shopId: { in: redeemedShopIds }, OR: LISTING_PROGRESS_OR },
          select: { shopId: true },
          distinct: ["shopId"],
        }),
    redeemedShopIds.length === 0
      ? Promise.resolve([])
      : prisma.shop.findMany({
          where: { id: { in: redeemedShopIds } },
          select: redeemedShopSelect,
        }),
  ]);

  const shopsById = new Map(shopsByIdRows.map((shop) => [shop.id, shop]));

  const listingProgressShopIds = new Set(shopsWithListingProgress.map((row) => row.shopId));

  const codes: AdminBetaTesterCodeRow[] = codeRows.map((row) => {
    const shop =
      row.redeemedByShop ??
      (row.redeemedByShopId ? (shopsById.get(row.redeemedByShopId) ?? null) : null);

    if (!row.redeemedAt && !shop) {
      return unusedCodeRow(row.id, row.code, row.createdAt);
    }

    if (!shop) {
      return {
        codeId: row.id,
        code: row.code,
        createdAt: row.createdAt.toISOString(),
        status: "used",
        shopAccount: null,
        shopFreeze: null,
        onboardingStatus: null,
        onboardingCompletedAt: null,
        incompleteSteps: [],
      };
    }

    const shopFreeze = {
      shopId: shop.id,
      adminFrozenAt: iso(shop.adminFrozenAt),
    };

    const owner = shop.users[0];
    const steps = computeShopOnboardingSteps({
      displayName: shop.displayName,
      itemGuidelinesAcknowledgedAt: shop.itemGuidelinesAcknowledgedAt,
      emailVerifiedAt: owner?.emailVerifiedAt ?? null,
      hasListingProgress: listingProgressShopIds.has(shop.id),
      connectChargesEnabled: shop.connectChargesEnabled,
      payoutsEnabled: shop.payoutsEnabled,
    });

    const onboardingStatus =
      shop.betaTesterOnboardingStatus ??
      (countIncompleteOnboardingSteps(steps) === 0
        ? BetaTesterOnboardingStatus.complete
        : BetaTesterOnboardingStatus.in_progress);

    return {
      codeId: row.id,
      code: row.code,
      createdAt: row.createdAt.toISOString(),
      status: "used",
      shopAccount: {
        shopId: shop.id,
        slug: shop.slug,
        displayName: shop.displayName,
        createdAt: (shop.betaTesterAt ?? row.redeemedAt ?? row.createdAt).toISOString(),
        adminFrozenAt: iso(shop.adminFrozenAt),
      },
      shopFreeze,
      onboardingStatus,
      onboardingCompletedAt: iso(shop.betaTesterOnboardingCompletedAt),
      incompleteSteps: incompleteOnboardingStepLabels(steps),
    };
  });

  return { codes };
}
