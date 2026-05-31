import {
  BetaTesterOnboardingStatus,
  ListingRequestStatus,
  ShopUserRole,
} from "@/generated/prisma/enums";
import {
  computeShopOnboardingSteps,
  countIncompleteOnboardingSteps,
  type ShopOnboardingSteps,
} from "@/lib/shop-onboarding-gate";
import { prisma } from "@/lib/prisma";

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

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export function incompleteOnboardingStepLabels(steps: ShopOnboardingSteps): string[] {
  const labels: string[] = [];
  if (!steps.profile) labels.push("Profile");
  if (!steps.guidelines) labels.push("Guidelines");
  if (!steps.emailVerified) labels.push("Email");
  if (!steps.listing) labels.push("Listing");
  if (!steps.stripe) labels.push("Stripe");
  return labels;
}

export async function syncBetaTesterOnboardingStatuses(): Promise<{
  ok: true;
  checked: number;
  updated: number;
  completed: number;
  skippedAlreadyCheckedToday: number;
}> {
  const now = new Date();
  const shops = await prisma.shop.findMany({
    where: { betaTesterAt: { not: null } },
    select: {
      id: true,
      displayName: true,
      itemGuidelinesAcknowledgedAt: true,
      connectChargesEnabled: true,
      payoutsEnabled: true,
      betaTesterOnboardingStatus: true,
      betaTesterOnboardingCheckedAt: true,
      betaTesterOnboardingCompletedAt: true,
      users: {
        where: { role: ShopUserRole.owner },
        select: { emailVerifiedAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  let checked = 0;
  let updated = 0;
  let completed = 0;
  let skippedAlreadyCheckedToday = 0;

  for (const shop of shops) {
    if (
      shop.betaTesterOnboardingStatus === BetaTesterOnboardingStatus.complete &&
      shop.betaTesterOnboardingCheckedAt &&
      isSameUtcDay(shop.betaTesterOnboardingCheckedAt, now)
    ) {
      skippedAlreadyCheckedToday++;
      continue;
    }

    checked++;

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

    const isComplete = countIncompleteOnboardingSteps(steps) === 0;
    const nextStatus = isComplete
      ? BetaTesterOnboardingStatus.complete
      : BetaTesterOnboardingStatus.in_progress;

    const statusChanged = shop.betaTesterOnboardingStatus !== nextStatus;
    const newlyComplete =
      isComplete &&
      shop.betaTesterOnboardingStatus !== BetaTesterOnboardingStatus.complete;

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        betaTesterOnboardingStatus: nextStatus,
        betaTesterOnboardingCheckedAt: now,
        ...(newlyComplete ? { betaTesterOnboardingCompletedAt: now } : {}),
      },
    });

    if (statusChanged || !shop.betaTesterOnboardingCheckedAt) updated++;
    if (newlyComplete) completed++;
  }

  return {
    ok: true,
    checked,
    updated,
    completed,
    skippedAlreadyCheckedToday,
  };
}