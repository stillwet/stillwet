/**
 * Copy `SiteEmailTemplate` rows (Admin → Backend → Email format) into StillWet production.
 *
 * Source (first match):
 *   SITE_EMAIL_SYNC_FROM_URL
 *   Local `.env` DATABASE_URL (typical after editing templates in local admin)
 *
 * Target (non-local only):
 *   SITE_EMAIL_SYNC_TARGET_URL
 *   `.env.production.local` → `.env.neon-verify` Postgres URLs
 *
 * Usage:
 *   npx vercel env pull .env.production.local --environment=production
 *   SITE_EMAIL_SYNC_CONFIRM=1 npm run db:copy-site-email-templates
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import {
  getSiteEmailTemplatesProdSyncAvailability,
  syncSiteEmailTemplatesToProduction,
} from "../src/lib/site-email-templates-prod-sync";

const root = path.join(__dirname, "..");

function loadEnvFile(file: string, override: boolean): void {
  const full = path.join(root, file);
  if (fs.existsSync(full)) dotenv.config({ path: full, override });
}

function resolveCliSourceUrl(): string | undefined {
  if (process.env.SITE_EMAIL_SYNC_FROM_URL?.trim()) {
    return process.env.SITE_EMAIL_SYNC_FROM_URL.trim();
  }
  loadEnvFile(".env", true);
  loadEnvFile(".env.local", true);
  loadEnvFile(".env.development.local", true);
  const t = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_PRISMA_URL?.trim();
  if (t?.startsWith("postgresql://") || t?.startsWith("postgres://")) return t;
  return undefined;
}

async function main() {
  loadEnvFile(".env", true);
  loadEnvFile(".env.local", true);
  loadEnvFile(".env.development.local", true);

  const sourceUrl = resolveCliSourceUrl();
  if (!sourceUrl) {
    console.error(
      "[copy-site-email-templates] Missing source URL. Set SITE_EMAIL_SYNC_FROM_URL or DATABASE_URL in .env.",
    );
    process.exit(1);
  }

  if (process.env.SITE_EMAIL_SYNC_CONFIRM !== "1") {
    console.error(
      "[copy-site-email-templates] Refusing to write to production without SITE_EMAIL_SYNC_CONFIRM=1",
    );
    process.exit(1);
  }

  const availability = getSiteEmailTemplatesProdSyncAvailability();
  if (!availability.canSync) {
    console.error(`[copy-site-email-templates] ${availability.message}`);
    process.exit(1);
  }

  console.log(`[copy-site-email-templates] Source host: ${availability.sourceHost}`);
  console.log(`[copy-site-email-templates] Target host: ${availability.targetHost}`);

  const result = await syncSiteEmailTemplatesToProduction({ sourceConnectionString: sourceUrl });
  if (!result.ok) {
    console.error(`[copy-site-email-templates] ${result.error}`);
    process.exit(1);
  }

  console.log(
    `[copy-site-email-templates] Done. Upserted ${result.upserted} template(s): ${result.keys.join(", ")}`,
  );
  if (result.missing.length > 0) {
    console.warn(
      `[copy-site-email-templates] Not on source (prod keeps prior/default for these): ${result.missing.join(", ")}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
