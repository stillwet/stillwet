/**
 * Upsert ShopFlairType rows from local Postgres into production (slug match).
 *
 * Source: DATABASE_URL / POSTGRES_PRISMA_URL in .env (must be localhost).
 * Target: same keys in .env.production.local (must be non-local).
 *
 * Usage:
 *   FLAIR_SYNC_CONFIRM=1 npm run db:copy-flairs-local-to-prod
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";

const root = path.join(__dirname, "..");

function isPostgresUrl(v: string | undefined): v is string {
  const t = v?.trim() ?? "";
  return t.startsWith("postgresql://") || t.startsWith("postgres://");
}

function isLocalHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return true;
  }
}

function maskHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid)";
  }
}

function postgresUrlFromEnv(keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (isPostgresUrl(v)) return v;
  }
  return undefined;
}

function loadEnvFile(file: string, override: boolean): void {
  const full = path.join(root, file);
  if (fs.existsSync(full)) dotenv.config({ path: full, override });
}

function loadLocalUrl(): string | undefined {
  loadEnvFile(".env", true);
  return postgresUrlFromEnv([
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
  ]);
}

function loadProdUrl(): string | undefined {
  const saved = { ...process.env };
  loadEnvFile(".env.production.local", true);
  const url = postgresUrlFromEnv([
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
    "PRISMA_MIGRATE_DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
  ]);
  Object.assign(process.env, saved);
  return url;
}

function newRowId(): string {
  return randomBytes(12).toString("base64url").slice(0, 25);
}

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.search = "";
    return x.toString();
  } catch {
    return u;
  }
}

async function main() {
  const sourceUrl = loadLocalUrl();
  const targetUrl = loadProdUrl();

  if (!sourceUrl) {
    console.error("[copy-flairs] Missing local DATABASE_URL in .env");
    process.exit(1);
  }
  if (!isLocalHost(sourceUrl)) {
    console.error(
      `[copy-flairs] Source must be local (got ${maskHost(sourceUrl)}). Use .env with localhost DATABASE_URL.`,
    );
    process.exit(1);
  }
  if (!targetUrl) {
    console.error("[copy-flairs] Missing production URL in .env.production.local");
    process.exit(1);
  }
  if (isLocalHost(targetUrl)) {
    console.error("[copy-flairs] Target must be production (non-local host).");
    process.exit(1);
  }
  if (normalizeUrl(sourceUrl) === normalizeUrl(targetUrl)) {
    console.error("[copy-flairs] Source and target URLs are the same; refusing.");
    process.exit(1);
  }
  if (process.env.FLAIR_SYNC_CONFIRM !== "1") {
    console.error(
      "[copy-flairs] Refusing to write to production without FLAIR_SYNC_CONFIRM=1",
    );
    process.exit(1);
  }

  console.log(`[copy-flairs] Source (local): ${maskHost(sourceUrl)}`);
  console.log(`[copy-flairs] Target (prod): ${maskHost(targetUrl)}`);

  const source = new pg.Pool({ connectionString: sourceUrl });
  const target = new pg.Pool({ connectionString: targetUrl });

  try {
    const { rows: flairs } = await source.query<{
      slug: string;
      label: string;
      sortOrder: number;
      active: boolean;
    }>(`SELECT slug, label, "sortOrder", active FROM "ShopFlairType" ORDER BY "sortOrder", slug`);

    if (flairs.length === 0) {
      console.log("[copy-flairs] No ShopFlairType rows in local database; nothing to copy.");
      return;
    }

    const client = await target.connect();
    try {
      await client.query("BEGIN");
      const now = new Date().toISOString();

      for (const row of flairs) {
        await client.query(
          `INSERT INTO "ShopFlairType" (id, slug, label, "sortOrder", active, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
           ON CONFLICT (slug) DO UPDATE SET
             label = EXCLUDED.label,
             "sortOrder" = EXCLUDED."sortOrder",
             active = EXCLUDED.active,
             "updatedAt" = EXCLUDED."updatedAt"`,
          [newRowId(), row.slug, row.label, row.sortOrder, row.active, now, now],
        );
      }

      await client.query("COMMIT");
      console.log(`[copy-flairs] Upserted ${flairs.length} flair type(s) by slug:`);
      for (const row of flairs) {
        console.log(`  - ${row.slug} (${row.label}) sort=${row.sortOrder} active=${row.active}`);
      }
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
