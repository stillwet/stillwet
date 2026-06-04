/**
 * Copy `SiteEmailTemplate` rows (Admin → Backend → Email format) into StillWet production.
 *
 * Source (first match):
 *   SITE_EMAIL_SYNC_FROM_URL
 *   Local `.env` DATABASE_URL (typical after editing templates in local admin)
 *
 * Target (non-local only):
 *   `.env.production.local` → `.env` → `.env.neon-verify` Postgres URLs
 *
 * Usage:
 *   npx vercel env pull .env.production.local --environment=production
 *   SITE_EMAIL_SYNC_CONFIRM=1 npm run db:copy-site-email-templates
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { SITE_EMAIL_TEMPLATE_KEYS } from "../src/lib/site-email-template-keys";

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

function postgresUrlFromEnv(keys: string[], allowLocal: boolean): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (!isPostgresUrl(v)) continue;
    if (!allowLocal && isLocalHost(v)) continue;
    return v;
  }
  for (const [k, v] of Object.entries(process.env)) {
    const t = v?.trim();
    if (!t || !isPostgresUrl(t)) continue;
    if (!allowLocal && isLocalHost(t)) continue;
    if (keys.some((suffix) => k.endsWith(suffix))) return t;
  }
  return undefined;
}

function loadEnvFile(file: string, override: boolean): void {
  const full = path.join(root, file);
  if (fs.existsSync(full)) dotenv.config({ path: full, override });
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

function newRowId(): string {
  return randomBytes(12).toString("base64url").slice(0, 25);
}

function loadSourceUrl(): string | undefined {
  if (process.env.SITE_EMAIL_SYNC_FROM_URL?.trim()) {
    return process.env.SITE_EMAIL_SYNC_FROM_URL.trim();
  }
  loadEnvFile(".env", true);
  loadEnvFile(".env.local", true);
  loadEnvFile(".env.development.local", true);
  return postgresUrlFromEnv(
    [
      "DATABASE_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
      "DIRECT_URL",
    ],
    true,
  );
}

function loadTargetUrl(): string | undefined {
  loadEnvFile(".env.production.local", false);
  loadEnvFile(".env", true);
  loadEnvFile(".env.neon-verify", true);
  return postgresUrlFromEnv(
    [
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
      "DIRECT_URL",
      "PRISMA_MIGRATE_DATABASE_URL",
      "POSTGRES_PRISMA_URL",
      "DATABASE_URL",
    ],
    false,
  );
}

async function main() {
  const sourceUrl = loadSourceUrl();
  const targetUrl = loadTargetUrl();

  if (!sourceUrl) {
    console.error(
      "[copy-site-email-templates] Missing source URL. Set SITE_EMAIL_SYNC_FROM_URL or DATABASE_URL in .env.",
    );
    process.exit(1);
  }
  if (!targetUrl) {
    console.error(
      "[copy-site-email-templates] Missing production Postgres URL. Run:\n" +
        "  npx vercel env pull .env.production.local --environment=production",
    );
    process.exit(1);
  }
  if (normalizeUrl(sourceUrl) === normalizeUrl(targetUrl)) {
    console.error("[copy-site-email-templates] Source and target URLs are the same; refusing.");
    process.exit(1);
  }
  if (process.env.SITE_EMAIL_SYNC_CONFIRM !== "1") {
    console.error(
      "[copy-site-email-templates] Refusing to write to production without SITE_EMAIL_SYNC_CONFIRM=1",
    );
    process.exit(1);
  }

  console.log(`[copy-site-email-templates] Source host: ${maskHost(sourceUrl)}`);
  console.log(`[copy-site-email-templates] Target host: ${maskHost(targetUrl)}`);

  const source = new pg.Pool({ connectionString: sourceUrl });
  const target = new pg.Pool({ connectionString: targetUrl });

  try {
    const { rows } = await source.query<{
      key: string;
      subject: string | null;
      htmlBody: string | null;
      textBody: string | null;
    }>(
      `SELECT key, subject, "htmlBody", "textBody"
       FROM "SiteEmailTemplate"
       ORDER BY key`,
    );

    if (rows.length === 0) {
      console.error(
        "[copy-site-email-templates] No SiteEmailTemplate rows on source. Save templates in admin first.",
      );
      process.exit(1);
    }

    const client = await target.connect();
    try {
      await client.query("BEGIN");
      const now = new Date().toISOString();
      let upserts = 0;

      for (const row of rows) {
        if (!(SITE_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(row.key)) {
          console.warn(`[copy-site-email-templates] Skipping unknown key: ${row.key}`);
          continue;
        }
        if (!row.subject?.trim() || !row.htmlBody?.trim()) {
          console.warn(`[copy-site-email-templates] Skipping incomplete row: ${row.key}`);
          continue;
        }
        await client.query(
          `INSERT INTO "SiteEmailTemplate" (id, key, subject, "htmlBody", "textBody", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
           ON CONFLICT (key) DO UPDATE SET
             subject = EXCLUDED.subject,
             "htmlBody" = EXCLUDED."htmlBody",
             "textBody" = EXCLUDED."textBody",
             "updatedAt" = EXCLUDED."updatedAt"`,
          [newRowId(), row.key, row.subject, row.htmlBody, row.textBody, now, now],
        );
        upserts += 1;
      }

      await client.query("COMMIT");

      const keys = rows.map((r) => r.key);
      const missing = SITE_EMAIL_TEMPLATE_KEYS.filter((k) => !keys.includes(k));
      console.log(
        `[copy-site-email-templates] Done. Upserted ${upserts} template(s): ${rows.map((r) => r.key).join(", ")}`,
      );
      if (missing.length > 0) {
        console.warn(
          `[copy-site-email-templates] Not on source (prod keeps prior/default for these): ${missing.join(", ")}`,
        );
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
