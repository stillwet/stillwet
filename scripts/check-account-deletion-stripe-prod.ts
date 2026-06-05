/** Read-only prod check: Stripe Connect balance for shop in account deletion. */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { connectBalanceBlocksDeletion, getStripeConnectBalanceUsdCents } from "../src/lib/stripe-connect-balance";

const root = path.join(__dirname, "..");
const slug = String(process.argv[2] ?? "stillwet-com").trim();

async function main() {
  const envFile = path.join(root, ".env.production.local");
  if (!fs.existsSync(envFile)) {
    console.error("Missing .env.production.local");
    process.exit(1);
  }
  dotenv.config({ path: envFile, override: true });

  const url =
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) process.exit(1);

  const pool = new pg.Pool({ connectionString: url });
  try {
    const { rows } = await pool.query<{
      slug: string;
      displayName: string;
      accountDeletionEmailConfirmedAt: Date | null;
      stripeConnectAccountId: string | null;
    }>(
      `SELECT slug, "displayName", "accountDeletionEmailConfirmedAt", "stripeConnectAccountId"
       FROM "Shop" WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    const shop = rows[0];
    if (!shop) {
      console.error(`No shop with slug ${slug}`);
      process.exit(1);
    }

    const balance = await getStripeConnectBalanceUsdCents(shop.stripeConnectAccountId);
    const blocks = connectBalanceBlocksDeletion(balance);

    console.log(JSON.stringify({
      slug: shop.slug,
      displayName: shop.displayName,
      emailConfirmed: shop.accountDeletionEmailConfirmedAt?.toISOString() ?? null,
      stripeConnectBalanceUsd: balance
        ? {
            available: (balance.availableCents / 100).toFixed(2),
            pending: (balance.pendingCents / 100).toFixed(2),
          }
        : null,
      deletionBlockedByStripeBalance: blocks,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
