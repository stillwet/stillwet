import type { Prisma } from "@/generated/prisma/client";
import {
  CreatorGiftCodeType,
  CreatorGiftPurchaseStatus,
} from "@/generated/prisma/enums";
import { generateCreatorGiftCode } from "@/lib/creator-gift-codes";
import { prisma } from "@/lib/prisma";

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
  throw new Error("Could not generate a unique waived shop fee invite code.");
}

export async function createWaivedShopFeeInviteCode(): Promise<{
  purchaseId: string;
  code: string;
}> {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.creatorGiftPurchase.create({
      data: {
        purchaserEmail: null,
        setupFeeIncluded: true,
        amountCents: 0,
        currency: "usd",
        status: CreatorGiftPurchaseStatus.paid,
        paidAt: new Date(),
        isWaivedShopFeeBatch: true,
      },
      select: { id: true },
    });

    const row = await createUniqueShopSetupGiftCode(tx, purchase.id);
    return { purchaseId: purchase.id, code: row.code };
  });
}
