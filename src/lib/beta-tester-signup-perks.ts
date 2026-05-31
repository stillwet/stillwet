import type { Prisma } from "@/generated/prisma/client";
import { ShopFlairPurchaseStatus } from "@/generated/prisma/enums";
import { BETA_TESTER_SIGNUP_LISTING_CREDITS } from "@/lib/beta-tester-codes";
import { isPrismaMissingRelationError } from "@/lib/prisma-missing-relation";

export const BETA_TESTER_SIGNUP_AWARD_LISTING_KEY = "free_listing_slots";
export const BETA_TESTER_SIGNUP_AWARD_FLAIR_KEY = "flair_access";

/** Grants beta-tester signup perks inside the shop-create transaction. */
export async function applyBetaTesterSignupPerksInTransaction(
  tx: Prisma.TransactionClient,
  args: { shopId: string; shopUserId: string },
): Promise<void> {
  const now = new Date();

  await tx.shop.update({
    where: { id: args.shopId },
    data: {
      listingFeeBonusFreeSlots: { increment: BETA_TESTER_SIGNUP_LISTING_CREDITS },
      flairPurchasedAt: now,
    },
  });

  await tx.shopFlairPurchase.create({
    data: {
      shopId: args.shopId,
      shopUserId: args.shopUserId,
      amountCents: 0,
      currency: "usd",
      status: ShopFlairPurchaseStatus.paid,
      paidAt: now,
    },
  });

  try {
    await tx.shopAdminAwardGrant.createMany({
      data: [
        {
          shopId: args.shopId,
          awardKey: BETA_TESTER_SIGNUP_AWARD_LISTING_KEY,
          quantity: BETA_TESTER_SIGNUP_LISTING_CREDITS,
        },
        {
          shopId: args.shopId,
          awardKey: BETA_TESTER_SIGNUP_AWARD_FLAIR_KEY,
          quantity: 1,
        },
      ],
    });
  } catch (e) {
    if (!isPrismaMissingRelationError(e)) throw e;
  }
}
