import type { Prisma } from "@/generated/prisma/client";
import {
  CreatorGiftCodeType,
  CreatorGiftPurchaseStatus,
} from "@/generated/prisma/enums";
import { generateCreatorGiftCode } from "@/lib/creator-gift-codes";
import { prisma } from "@/lib/prisma";

export const BETA_TESTER_COHORT_LABEL = "Beta Tester";
export const DEFAULT_BETA_TESTER_CODE_COUNT = 50;
export const BETA_TESTER_SIGNUP_LISTING_CREDITS = 10;

async function createUniqueShopSetupGiftCode(
  tx: Prisma.TransactionClient,
  purchaseId: string,
): Promise<{ code: string; codeNormalized: string }> {
  for (let i = 0; i < 8; i++) {
    const generated = generateCreatorGiftCode("SETUP");
    try {
      const row = await tx.creatorGiftCode.create({
        data: {
          purchaseId,
          type: CreatorGiftCodeType.shop_setup,
          code: generated.code,
          codeNormalized: generated.codeNormalized,
        },
        select: { code: true, codeNormalized: true },
      });
      return row;
    } catch (e) {
      const code = e as { code?: string };
      if (code.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not generate a unique beta tester invite code.");
}

export async function createBetaTesterInviteCodes(
  count = DEFAULT_BETA_TESTER_CODE_COUNT,
): Promise<{ purchaseId: string; codes: string[] }> {
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    throw new Error("Beta tester code count must be between 1 and 500.");
  }

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.creatorGiftPurchase.create({
      data: {
        purchaserEmail: null,
        setupFeeIncluded: true,
        amountCents: 0,
        currency: "usd",
        status: CreatorGiftPurchaseStatus.paid,
        paidAt: new Date(),
        isBetaTesterBatch: true,
      },
      select: { id: true },
    });

    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const row = await createUniqueShopSetupGiftCode(tx, purchase.id);
      codes.push(row.code);
    }

    return { purchaseId: purchase.id, codes };
  });
}
