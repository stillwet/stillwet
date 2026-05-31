import {
  BetaTesterOnboardingStatus,
  CreatorGiftCodeType,
  ListingRequestStatus,
  ShopUserRole,
} from "@/generated/prisma/enums";
import { BETA_TESTER_COHORT_LABEL } from "@/lib/beta-tester-codes";
import {
  computeShopOnboardingSteps,
  countIncompleteOnboardingSteps,
} from "@/lib/shop-onboarding-gate";
import { incompleteOnboardingStepLabels } from "@/lib/beta-tester-onboarding-sync";
import { prisma } from "@/lib/prisma";

export type AdminBetaTesterShopRow = {
  shopId: string;
  displayName: string;
  slug: string;
  cohortLabel: typeof BETA_TESTER_COHORT_LABEL;
  signedUpAt: string;
  onboardingStatus: BetaTesterOnboardingStatus;
  onboardingCheckedAt: string | null;
  onboardingCompletedAt: string | null;
  incompleteSteps: string[];
  inviteCode: string | null;
};

export type AdminBetaTesterUnusedCodeRow = {
  code: string;
  createdAt: string;
};

export type AdminBetaTesterDashboardPayload = {
  summary: {
    unusedCodes: number;
    shopsSignedUp: number;
    onboardingComplete: number;
    onboardingInProgress: number;
  };
  shops: AdminBetaTesterShopRow[];
  unusedCodes: AdminBetaTesterUnusedCodeRow[];
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

export async function loadAdminBetaTesterDashboardPayload(): Promise<AdminBetaTesterDashboardPayload> {
  const [shops, unusedCodeRows] = await Promise.all([
    prisma.shop.findMany({
      where: { betaTesterAt: { not: null } },
      orderBy: [{ betaTesterAt: "desc" }],
      select: {
        id: true,
        slug: true,
        displayName: true,
        betaTesterAt: true,
        betaTesterOnboardingStatus: true,
        betaTesterOnboardingCheckedAt: true,
        betaTesterOnboardingCompletedAt: true,
        itemGuidelinesAcknowledgedAt: true,
        connectChargesEnabled: true,
        payoutsEnabled: true,
        users: {
          where: { role: ShopUserRole.owner },
          select: { emailVerifiedAt: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        creatorGiftCodesRedeemed: {
          where: { type: CreatorGiftCodeType.shop_setup },
          select: { code: true },
          take: 1,
        },
      },
    }),
    prisma.creatorGiftCode.findMany({
      where: {
        type: CreatorGiftCodeType.shop_setup,
        redeemedAt: null,
        purchase: { isBetaTesterBatch: true },
      },
      orderBy: { createdAt: "asc" },
      select: { code: true, createdAt: true },
    }),
  ]);

  const shopRows: AdminBetaTesterShopRow[] = [];
  let onboardingComplete = 0;
  let onboardingInProgress = 0;

  for (const shop of shops) {
    const hasListingProgress = Boolean(
      await prisma.shopListing.findFirst({
        where: { shopId: shop.id, OR: LISTING_PROGRESS_OR },
        select: { id: true },
      }),
    );

    const owner = shop.users[0];
    const steps = computeShopOnboardingSteps({
      displayName: shop.displayName,
      itemGuidelinesAcknowledgedAt: shop.itemGuidelinesAcknowledgedAt,
      emailVerifiedAt: owner?.emailVerifiedAt ?? null,
      hasListingProgress,
      connectChargesEnabled: shop.connectChargesEnabled,
      payoutsEnabled: shop.payoutsEnabled,
    });

    const status =
      shop.betaTesterOnboardingStatus ??
      (countIncompleteOnboardingSteps(steps) === 0
        ? BetaTesterOnboardingStatus.complete
        : BetaTesterOnboardingStatus.in_progress);

    if (status === BetaTesterOnboardingStatus.complete) onboardingComplete++;
    else onboardingInProgress++;

    shopRows.push({
      shopId: shop.id,
      displayName: shop.displayName,
      slug: shop.slug,
      cohortLabel: BETA_TESTER_COHORT_LABEL,
      signedUpAt: shop.betaTesterAt!.toISOString(),
      onboardingStatus: status,
      onboardingCheckedAt: iso(shop.betaTesterOnboardingCheckedAt),
      onboardingCompletedAt: iso(shop.betaTesterOnboardingCompletedAt),
      incompleteSteps: incompleteOnboardingStepLabels(steps),
      inviteCode: shop.creatorGiftCodesRedeemed[0]?.code ?? null,
    });
  }

  return {
    summary: {
      unusedCodes: unusedCodeRows.length,
      shopsSignedUp: shops.length,
      onboardingComplete,
      onboardingInProgress,
    },
    shops: shopRows,
    unusedCodes: unusedCodeRows.map((row) => ({
      code: row.code,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
