/**
 * Read-only audit: rows that do or do not count toward admin Shop creation revenue.
 *
 * Usage:
 *   npx tsx scripts/audit-shop-creation-revenue.ts
 *   AUDIT_PROD=1 npx tsx scripts/audit-shop-creation-revenue.ts
 *
 * Uses DATABASE_URL from .env.local (or .env.production.local when AUDIT_PROD=1).
 * Does not mutate the database.
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "..");
const useProd = process.env.AUDIT_PROD === "1";
const envFile = useProd
  ? path.join(root, ".env.production.local")
  : path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile, override: true });
} else {
  dotenv.config({ path: path.join(root, ".env") });
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

async function main() {
  const {
    CreatorGiftPurchaseStatus,
    ShopSetupFeePurchaseStatus,
  } = await import("../src/generated/prisma/enums");
  const {
    countsTowardShopCreationRevenue,
    giftedShopSetupPurchaseRevenueWhere,
    shopSetupFeePurchaseRevenueWhere,
  } = await import("../src/lib/admin-platform-sales-merged-lines");
  const { ensurePrismaClient } = await import("../src/lib/prisma");
  const prisma = ensurePrismaClient();

  const lifetimeGte = new Date(Date.UTC(2026, 5, 1, 0, 0, 0, 0));
  const through = new Date();

  const [selfPayIncluded, giftIncluded, selfPayAll, giftSetupAll, betaBatches, waivedBatches] =
    await Promise.all([
      prisma.shopSetupFeePurchase.findMany({
        where: shopSetupFeePurchaseRevenueWhere(lifetimeGte, through),
        select: {
          id: true,
          amountCents: true,
          paidAt: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
        },
        orderBy: { paidAt: "asc" },
      }),
      prisma.creatorGiftPurchase.findMany({
        where: giftedShopSetupPurchaseRevenueWhere(lifetimeGte, through),
        select: {
          id: true,
          amountCents: true,
          paidAt: true,
          purchaserEmail: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
        },
        orderBy: { paidAt: "asc" },
      }),
      prisma.shopSetupFeePurchase.findMany({
        where: { status: ShopSetupFeePurchaseStatus.paid, paidAt: { not: null } },
        select: {
          id: true,
          amountCents: true,
          paidAt: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
        },
      }),
      prisma.creatorGiftPurchase.findMany({
        where: {
          status: CreatorGiftPurchaseStatus.paid,
          setupFeeIncluded: true,
          paidAt: { not: null },
        },
        select: {
          id: true,
          amountCents: true,
          paidAt: true,
          purchaserEmail: true,
          isBetaTesterBatch: true,
          isWaivedShopFeeBatch: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
        },
      }),
      prisma.creatorGiftPurchase.count({ where: { isBetaTesterBatch: true } }),
      prisma.creatorGiftPurchase.count({ where: { isWaivedShopFeeBatch: true } }),
    ]);

  const includedTotal =
    selfPayIncluded.reduce((s, r) => s + r.amountCents, 0) +
    giftIncluded.reduce((s, r) => s + r.amountCents, 0);

  const excludedSelfPay = selfPayAll.filter(
    (row) =>
      !countsTowardShopCreationRevenue({
        source: "shop_setup_fee",
        status: "paid",
        amountCents: row.amountCents,
        stripeCheckoutSessionId: row.stripeCheckoutSessionId,
        stripePaymentIntentId: row.stripePaymentIntentId,
      }),
  );
  const excludedGifts = giftSetupAll.filter(
    (row) =>
      !countsTowardShopCreationRevenue({
        source: "creator_gift",
        status: "paid",
        amountCents: row.amountCents,
        setupFeeIncluded: true,
        isBetaTesterBatch: row.isBetaTesterBatch,
        isWaivedShopFeeBatch: row.isWaivedShopFeeBatch,
        stripeCheckoutSessionId: row.stripeCheckoutSessionId,
        stripePaymentIntentId: row.stripePaymentIntentId,
      }),
  );

  console.info(`Shop creation revenue audit (${useProd ? "production" : "local"})`);
  console.info(`Window: ${lifetimeGte.toISOString()} → ${through.toISOString()}`);
  console.info("");
  console.info(`Included total: ${formatUsd(includedTotal)}`);
  console.info(`  Self-pay rows: ${selfPayIncluded.length}`);
  console.info(`  Paid setup gift rows: ${giftIncluded.length}`);
  console.info("");
  console.info(`Excluded admin batches: beta=${betaBatches}, waived=${waivedBatches}`);
  console.info(`Excluded self-pay rows (paid but filtered out): ${excludedSelfPay.length}`);
  console.info(`Excluded setup gift rows (paid but filtered out): ${excludedGifts.length}`);

  if (selfPayIncluded.length > 0) {
    console.info("\nIncluded self-pay:");
    for (const row of selfPayIncluded) {
      console.info(
        `  ${row.id} ${formatUsd(row.amountCents)} paidAt=${row.paidAt?.toISOString()} session=${row.stripeCheckoutSessionId ?? "—"}`,
      );
    }
  }
  if (giftIncluded.length > 0) {
    console.info("\nIncluded paid setup gifts:");
    for (const row of giftIncluded) {
      console.info(
        `  ${row.id} ${formatUsd(row.amountCents)} ${row.purchaserEmail ?? "—"} paidAt=${row.paidAt?.toISOString()}`,
      );
    }
  }
  if (excludedGifts.length > 0) {
    console.info("\nExcluded setup gift rows (sample):");
    for (const row of excludedGifts.slice(0, 10)) {
      console.info(
        `  ${row.id} ${formatUsd(row.amountCents)} beta=${row.isBetaTesterBatch} waived=${row.isWaivedShopFeeBatch} session=${row.stripeCheckoutSessionId ?? "—"}`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
