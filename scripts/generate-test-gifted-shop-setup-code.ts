/**
 * Create one paid creator-gift shop setup code for local / staging testing.
 *
 * Usage:
 *   npx tsx scripts/generate-test-gifted-shop-setup-code.ts [purchaserEmail]
 *
 * Default purchaser email: test-gift@example.com
 *
 * Requires DATABASE_URL in .env — mutates the database.
 */
import "dotenv/config";
import type { Prisma } from "@/generated/prisma/client";
import {
  CreatorGiftCodeType,
  CreatorGiftFulfillmentMode,
  CreatorGiftPurchaseStatus,
} from "@/generated/prisma/enums";
import { generateCreatorGiftCode, SHOP_SETUP_FEE_CENTS } from "@/lib/creator-gift-codes";
import { purchasedShopSetupGiftCodeExpiresAt } from "@/lib/creator-gift-code-expiration";
import { prisma } from "@/lib/prisma";

async function createUniqueShopSetupGiftCode(
  tx: Prisma.TransactionClient,
  purchaseId: string,
): Promise<string> {
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
        select: { code: true },
      });
      return row.code;
    } catch (e) {
      const code = e as { code?: string };
      if (code.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not generate a unique gifted shop setup code.");
}

async function main() {
  const purchaserEmail =
    String(process.argv[2] ?? "test-gift@example.com").trim().toLowerCase() ||
    "test-gift@example.com";

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.creatorGiftPurchase.create({
      data: {
        purchaserEmail,
        fulfillmentMode: CreatorGiftFulfillmentMode.email_codes,
        setupFeeIncluded: true,
        amountCents: SHOP_SETUP_FEE_CENTS,
        currency: "usd",
        status: CreatorGiftPurchaseStatus.paid,
        paidAt: new Date(),
      },
      select: { id: true, createdAt: true },
    });

    const code = await createUniqueShopSetupGiftCode(tx, purchase.id);
    const expiresAt = purchasedShopSetupGiftCodeExpiresAt(purchase.createdAt);

    return {
      purchaseId: purchase.id,
      code,
      purchaserEmail,
      expiresAt: expiresAt.toISOString(),
    };
  });

  console.info("Test gifted shop setup code created:");
  console.info(`  Code:            ${result.code}`);
  console.info(`  Purchaser email: ${result.purchaserEmail}`);
  console.info(`  Expires:         ${result.expiresAt}`);
  console.info(`  Purchase id:     ${result.purchaseId}`);
  console.info("");
  console.info("Redeem on Create Shop signup, or view in Admin → Waived shop fees → Gifted codes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
