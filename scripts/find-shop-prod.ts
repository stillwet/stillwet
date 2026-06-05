/** Read-only: find shop / user rows matching stillwet on production. */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.join(__dirname, "..");
const needle = String(process.argv[2] ?? "stillwet").trim().toLowerCase();

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
  const like = `%${needle}%`;
  try {
    const shops = await pool.query(
      `SELECT slug, "displayName", active, "accountDeletionRequestedAt", "accountDeletionEmailConfirmedAt"
       FROM "Shop"
       WHERE LOWER(slug) LIKE $1 OR LOWER("displayName") LIKE $1
       ORDER BY slug LIMIT 10`,
      [like],
    );
    const users = await pool.query(
      `SELECT u.email, s.slug, s."displayName"
       FROM "ShopUser" u
       LEFT JOIN "Shop" s ON s.id = u."shopId"
       WHERE LOWER(u.email) LIKE $1 OR LOWER(s.slug) LIKE $1 OR LOWER(s."displayName") LIKE $1
       LIMIT 10`,
      [like],
    );
    console.log("shops:", JSON.stringify(shops.rows, null, 2));
    console.log("users:", JSON.stringify(users.rows, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
