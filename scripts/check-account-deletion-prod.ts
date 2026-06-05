/**
 * Read-only: account deletion status on production for a shop slug/email fragment.
 * Usage: npx tsx scripts/check-account-deletion-prod.ts [shop-slug-or-email-fragment]
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.join(__dirname, "..");
const needle = String(process.argv[2] ?? "").trim().toLowerCase();

function loadProdUrl(): string | undefined {
  const envFile = path.join(root, ".env.production.local");
  if (!fs.existsSync(envFile)) return undefined;
  dotenv.config({ path: envFile, override: true });
  return (
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_URL?.trim()
  );
}

async function main() {
  const url = loadProdUrl();
  if (!url) {
    console.error("Missing production DATABASE_URL in .env.production.local");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    const params: unknown[] = [];
    let filter = needle
      ? `(LOWER(s.slug) LIKE $1 OR LOWER(s."displayName") LIKE $1 OR LOWER(u.email) LIKE $1)`
      : `s."accountDeletionRequestedAt" IS NOT NULL`;
    if (needle) {
      params.push(`%${needle}%`);
    }

    const { rows } = await pool.query<{
      slug: string;
      displayName: string;
      ownerEmail: string;
      accountDeletionRequestedAt: Date;
      accountDeletionEmailConfirmedAt: Date | null;
      active: boolean;
      stripeConnectAccountId: string | null;
      unusedTokens: number;
      usedTokenAt: Date | null;
    }>(
      `SELECT
        s.slug,
        s."displayName",
        u.email AS "ownerEmail",
        s."accountDeletionRequestedAt",
        s."accountDeletionEmailConfirmedAt",
        s.active,
        s."stripeConnectAccountId",
        (
          SELECT COUNT(*)::int
          FROM "ShopAccountDeletionToken" t
          WHERE t."shopUserId" = u.id AND t."usedAt" IS NULL AND t."expiresAt" > NOW()
        ) AS "unusedTokens",
        (
          SELECT MAX(t."usedAt")
          FROM "ShopAccountDeletionToken" t
          WHERE t."shopUserId" = u.id
        ) AS "usedTokenAt"
      FROM "Shop" s
      JOIN "ShopUser" u ON u."shopId" = s.id
      WHERE ${filter}
      ORDER BY s."accountDeletionRequestedAt" DESC
      LIMIT 20`,
      params,
    );

    if (rows.length === 0) {
      console.log(
        needle
          ? `No shop on production matching "${needle}".`
          : "No shops with accountDeletionRequestedAt set on production.",
      );
      return;
    }

    for (const row of rows) {
      console.log("---");
      console.log(`Shop: ${row.displayName} (${row.slug})`);
      console.log(`Owner email: ${row.ownerEmail}`);
      console.log(`Deletion requested: ${row.accountDeletionRequestedAt.toISOString()}`);
      console.log(
        `Email confirmed: ${row.accountDeletionEmailConfirmedAt?.toISOString() ?? "NOT YET"}`,
      );
      console.log(`Shop active flag: ${row.active}`);
      console.log(`Stripe Connect: ${row.stripeConnectAccountId ? "yes" : "no"}`);
      console.log(`Unused valid tokens: ${row.unusedTokens}`);
      console.log(`Last token used at: ${row.usedTokenAt?.toISOString() ?? "never"}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
