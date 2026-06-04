import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { runtimeDatabaseUrlFromEnv } from "@/lib/env-postgres-url";
import { prisma } from "@/lib/prisma";
import { SITE_EMAIL_TEMPLATE_KEYS } from "@/lib/site-email-template-keys";

type TemplateRow = {
  key: string;
  subject: string | null;
  htmlBody: string | null;
  textBody: string | null;
};

export type SiteEmailTemplatesProdSyncAvailability = {
  canSync: boolean;
  sourceHost: string | null;
  targetHost: string | null;
  message: string;
};

export type SiteEmailTemplatesProdSyncResult =
  | {
      ok: true;
      upserted: number;
      keys: string[];
      missing: string[];
      sourceHost: string;
      targetHost: string;
    }
  | { ok: false; error: string };

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

function loadProductionTargetEnvFiles(): void {
  const root = process.cwd();
  for (const file of [".env.production.local", ".env.neon-verify"]) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) {
      dotenv.config({ path: full, override: false });
    }
  }
}

function resolveSourceUrl(): string | undefined {
  const override = process.env.SITE_EMAIL_SYNC_FROM_URL?.trim();
  if (override && isPostgresUrl(override)) return override;
  return runtimeDatabaseUrlFromEnv();
}

function resolveTargetUrl(): string | undefined {
  const override = process.env.SITE_EMAIL_SYNC_TARGET_URL?.trim();
  if (override && isPostgresUrl(override)) return override;

  loadProductionTargetEnvFiles();
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

export function getSiteEmailTemplatesProdSyncAvailability(): SiteEmailTemplatesProdSyncAvailability {
  const sourceUrl = resolveSourceUrl();
  const targetUrl = resolveTargetUrl();

  if (!sourceUrl) {
    return {
      canSync: false,
      sourceHost: null,
      targetHost: targetUrl ? maskHost(targetUrl) : null,
      message: "No source database URL for this admin host.",
    };
  }
  if (!targetUrl) {
    return {
      canSync: false,
      sourceHost: maskHost(sourceUrl),
      targetHost: null,
      message:
        "Production Postgres URL not configured. On your machine run: npx vercel env pull .env.production.local --environment=production (or set SITE_EMAIL_SYNC_TARGET_URL).",
    };
  }
  if (normalizeUrl(sourceUrl) === normalizeUrl(targetUrl)) {
    return {
      canSync: false,
      sourceHost: maskHost(sourceUrl),
      targetHost: maskHost(targetUrl),
      message:
        "This admin already uses the production database. Save templates here — no separate sync is needed.",
    };
  }

  return {
    canSync: true,
    sourceHost: maskHost(sourceUrl),
    targetHost: maskHost(targetUrl),
    message: `Copy saved templates from ${maskHost(sourceUrl)} to production (${maskHost(targetUrl)}).`,
  };
}

async function loadSourceRows(sourceConnectionString?: string): Promise<TemplateRow[]> {
  if (sourceConnectionString) {
    const pool = new Pool({ connectionString: sourceConnectionString });
    try {
      const { rows } = await pool.query<TemplateRow>(
        `SELECT key, subject, "htmlBody", "textBody"
         FROM "SiteEmailTemplate"
         ORDER BY key`,
      );
      return rows;
    } finally {
      await pool.end();
    }
  }

  return prisma.siteEmailTemplate.findMany({
    orderBy: { key: "asc" },
    select: { key: true, subject: true, htmlBody: true, textBody: true },
  });
}

export async function syncSiteEmailTemplatesToProduction(options?: {
  /** CLI: read rows from this URL instead of the runtime Prisma database. */
  sourceConnectionString?: string;
}): Promise<SiteEmailTemplatesProdSyncResult> {
  const availability = getSiteEmailTemplatesProdSyncAvailability();
  const targetUrl = resolveTargetUrl();
  if (!availability.canSync || !targetUrl) {
    return { ok: false, error: availability.message };
  }

  const sourceUrl = options?.sourceConnectionString?.trim() || resolveSourceUrl();
  if (!sourceUrl) {
    return { ok: false, error: "Missing source database URL." };
  }
  if (normalizeUrl(sourceUrl) === normalizeUrl(targetUrl)) {
    return { ok: false, error: "Source and target databases are the same." };
  }

  const rows = await loadSourceRows(options?.sourceConnectionString);
  if (rows.length === 0) {
    return {
      ok: false,
      error: "No saved templates on the source database. Save templates in admin first.",
    };
  }

  const target = new Pool({ connectionString: targetUrl });
  try {
    const client = await target.connect();
    try {
      await client.query("BEGIN");
      const now = new Date().toISOString();
      let upserted = 0;
      const upsertedKeys: string[] = [];

      for (const row of rows) {
        if (!(SITE_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(row.key)) continue;
        if (!row.subject?.trim() || !row.htmlBody?.trim()) continue;

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
        upserted += 1;
        upsertedKeys.push(row.key);
      }

      if (upserted === 0) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: "No complete template rows to copy (each needs a subject and HTML body).",
        };
      }

      await client.query("COMMIT");

      const sourceKeys = rows.map((r) => r.key);
      const missing = SITE_EMAIL_TEMPLATE_KEYS.filter((k) => !sourceKeys.includes(k));

      return {
        ok: true,
        upserted,
        keys: upsertedKeys,
        missing,
        sourceHost: maskHost(sourceUrl),
        targetHost: maskHost(targetUrl),
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed.";
    return { ok: false, error: msg };
  } finally {
    await target.end();
  }
}
