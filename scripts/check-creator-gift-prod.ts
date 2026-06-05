/** Read-only: recent creator gift purchases on production. */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.join(__dirname, "..");
const emailNeedle = String(process.argv[2] ?? "").trim().toLowerCase();

async function main() {
  const envFile = path.join(root, ".env.production.local");
  if (!fs.existsSync(envFile)) process.exit(1);
  dotenv.config({ path: envFile, override: true });
  const url =
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) process.exit(1);

  const pool = new pg.Pool({ connectionString: url });
  try {
    const params: unknown[] = [];
    let emailFilter = "";
    if (emailNeedle) {
      params.push(`%${emailNeedle}%`);
      emailFilter = `AND LOWER(p."purchaserEmail") LIKE $1`;
    }
    const { rows } = await pool.query(
      `SELECT
        p.id,
        p."purchaserEmail",
        p.status,
        p."fulfillmentMode",
        p."setupFeeIncluded",
        p."paidAt",
        p."emailedAt",
        p."stripeCheckoutSessionId",
        p."createdAt",
        (
          SELECT string_agg(c.code, ', ' ORDER BY c."createdAt")
          FROM "CreatorGiftCode" c
          WHERE c."purchaseId" = p.id
        ) AS codes
      FROM "CreatorGiftPurchase" p
      WHERE p."fulfillmentMode" = 'email_codes'
      ${emailFilter}
      ORDER BY p."createdAt" DESC
      LIMIT 10`,
      params,
    );
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
