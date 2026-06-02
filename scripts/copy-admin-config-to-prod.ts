/**
 * Copy admin config lists from xtinadom (or any source) Postgres into StillWet production:
 * Tag, ShopFlairType, ModerationKeyword, AdminCatalogItem (text only), AdminCatalogItemTag.
 *
 * Source (first match):
 *   ADMIN_CONFIG_SYNC_FROM_URL
 *   .env.xtinadom (from `npx vercel env pull .env.xtinadom` on xtinadom-merch project)
 *
 * Target (first non-local):
 *   .env.production.local → .env → .env.neon-verify
 *   POSTGRES_URL_NON_POOLING / POSTGRES_PRISMA_URL
 *
 * Usage:
 *   npx vercel env pull .env.xtinadom --environment=production   # if needed
 *   ADMIN_CONFIG_SYNC_CONFIRM=1 npm run db:copy-admin-config
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
    if (isPostgresUrl(v) && !isLocalHost(v)) return v;
  }
  for (const [k, v] of Object.entries(process.env)) {
    const t = v?.trim();
    if (!t || !isPostgresUrl(t) || isLocalHost(t)) continue;
    if (keys.some((suffix) => k.endsWith(suffix))) return t;
  }
  return undefined;
}

function loadEnvFile(file: string, override: boolean): void {
  const full = path.join(root, file);
  if (fs.existsSync(full)) dotenv.config({ path: full, override });
}

function loadSourceUrl(): string | undefined {
  if (process.env.ADMIN_CONFIG_SYNC_FROM_URL?.trim()) {
    return process.env.ADMIN_CONFIG_SYNC_FROM_URL.trim();
  }
  const saved = { ...process.env };
  loadEnvFile(".env.xtinadom", true);
  const fromXtinadom =
    postgresUrlFromEnv([
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
      "DIRECT_URL",
      "PRISMA_MIGRATE_DATABASE_URL",
      "POSTGRES_PRISMA_URL",
      "DATABASE_URL",
    ]) ??
    postgresUrlFromEnv(["_POSTGRES_URL_NON_POOLING", "_DATABASE_URL_UNPOOLED", "_POSTGRES_PRISMA_URL"]);
  Object.assign(process.env, saved);
  return fromXtinadom;
}

function loadTargetUrl(): string | undefined {
  loadEnvFile(".env.production.local", false);
  loadEnvFile(".env", true);
  loadEnvFile(".env.neon-verify", true);
  return (
    postgresUrlFromEnv([
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
      "DIRECT_URL",
      "PRISMA_MIGRATE_DATABASE_URL",
      "POSTGRES_PRISMA_URL",
      "DATABASE_URL",
    ]) ??
    postgresUrlFromEnv(["_POSTGRES_URL_NON_POOLING", "_DATABASE_URL_UNPOOLED", "_POSTGRES_PRISMA_URL"])
  );
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
  const sourceUrl = loadSourceUrl();
  const targetUrl = loadTargetUrl();

  if (!sourceUrl) {
    console.error(
      "[copy-admin-config] Missing source URL. Set ADMIN_CONFIG_SYNC_FROM_URL or run:\n" +
        "  npx vercel env pull .env.xtinadom --environment=production\n" +
        "  (from a directory linked to xtinadom-merch)",
    );
    process.exit(1);
  }
  if (!targetUrl) {
    console.error("[copy-admin-config] Missing target Neon URL in .env / .env.production.local");
    process.exit(1);
  }
  if (normalizeUrl(sourceUrl) === normalizeUrl(targetUrl)) {
    console.error("[copy-admin-config] Source and target URLs are the same; refusing.");
    process.exit(1);
  }
  if (process.env.ADMIN_CONFIG_SYNC_CONFIRM !== "1") {
    console.error(
      "[copy-admin-config] Refusing to write to non-local target without ADMIN_CONFIG_SYNC_CONFIRM=1",
    );
    process.exit(1);
  }

  console.log(`[copy-admin-config] Source host: ${maskHost(sourceUrl)}`);
  console.log(`[copy-admin-config] Target host: ${maskHost(targetUrl)}`);

  const source = new pg.Pool({ connectionString: sourceUrl });
  const target = new pg.Pool({ connectionString: targetUrl });

  try {
    const { rows: tags } = await source.query<{
      slug: string;
      name: string;
      sortOrder: number;
    }>(`SELECT slug, name, "sortOrder" FROM "Tag" ORDER BY "sortOrder", slug`);

    const { rows: flairs } = await source.query<{
      slug: string;
      label: string;
      sortOrder: number;
      active: boolean;
    }>(`SELECT slug, label, "sortOrder", active FROM "ShopFlairType" ORDER BY "sortOrder", slug`);

    const { rows: keywords } = await source.query<{
      phrase: string;
      phraseNormalized: string;
      createdAt: Date;
    }>(`SELECT phrase, "phraseNormalized", "createdAt" FROM "ModerationKeyword" ORDER BY "phraseNormalized"`);

    const { rows: catalog } = await source.query<{
      sortOrder: number;
      name: string;
      storefrontDescription: string | null;
      itemExampleListingUrl: string | null;
      itemMinPriceCents: number;
      itemGoodsServicesCostCents: number;
      itemImageRequirementLabel: string | null;
      itemMinArtworkLongEdgePx: number | null;
      itemPrintAreaWidthPx: number | null;
      itemPrintAreaHeightPx: number | null;
      itemMinArtworkDpi: number | null;
    }>(
      `SELECT "sortOrder", name, "storefrontDescription", "itemExampleListingUrl",
              "itemMinPriceCents", "itemGoodsServicesCostCents", "itemImageRequirementLabel",
              "itemMinArtworkLongEdgePx", "itemPrintAreaWidthPx", "itemPrintAreaHeightPx", "itemMinArtworkDpi"
       FROM "AdminCatalogItem"
       ORDER BY "sortOrder", name`,
    );

    const { rows: catalogTags } = await source.query<{
      itemSortOrder: number;
      itemName: string;
      tagSlug: string;
    }>(
      `SELECT i."sortOrder" AS "itemSortOrder", i.name AS "itemName", t.slug AS "tagSlug"
       FROM "AdminCatalogItemTag" ct
       JOIN "AdminCatalogItem" i ON i.id = ct."adminCatalogItemId"
       JOIN "Tag" t ON t.id = ct."tagId"
       ORDER BY i."sortOrder", t.slug`,
    );

    const client = await target.connect();
    try {
      await client.query("BEGIN");
      const now = new Date().toISOString();

      let tagUpserts = 0;
      for (const row of tags) {
        const r = await client.query(
          `INSERT INTO "Tag" (id, slug, name, "sortOrder", "byItemSpotlightProductId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, NULL, $5::timestamptz, $6::timestamptz)
           ON CONFLICT (slug) DO UPDATE SET
             name = EXCLUDED.name,
             "sortOrder" = EXCLUDED."sortOrder",
             "updatedAt" = EXCLUDED."updatedAt"`,
          [newRowId(), row.slug, row.name, row.sortOrder, now, now],
        );
        tagUpserts += r.rowCount ?? 0;
      }

      let flairUpserts = 0;
      for (const row of flairs) {
        const r = await client.query(
          `INSERT INTO "ShopFlairType" (id, slug, label, "sortOrder", active, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
           ON CONFLICT (slug) DO UPDATE SET
             label = EXCLUDED.label,
             "sortOrder" = EXCLUDED."sortOrder",
             active = EXCLUDED.active,
             "updatedAt" = EXCLUDED."updatedAt"`,
          [newRowId(), row.slug, row.label, row.sortOrder, row.active, now, now],
        );
        flairUpserts += r.rowCount ?? 0;
      }

      let keywordUpserts = 0;
      for (const row of keywords) {
        const r = await client.query(
          `INSERT INTO "ModerationKeyword" (id, phrase, "phraseNormalized", "createdAt")
           VALUES ($1, $2, $3, $4::timestamptz)
           ON CONFLICT ("phraseNormalized") DO UPDATE SET phrase = EXCLUDED.phrase`,
          [newRowId(), row.phrase, row.phraseNormalized, row.createdAt.toISOString()],
        );
        keywordUpserts += r.rowCount ?? 0;
      }

      await client.query(`DELETE FROM "AdminCatalogItemTag"`);
      await client.query(`DELETE FROM "AdminCatalogItem"`);

      const itemKeyToId = new Map<string, string>();
      for (const row of catalog) {
        const id = newRowId();
        const key = `${row.sortOrder}\0${row.name}`;
        itemKeyToId.set(key, id);
        await client.query(
          `INSERT INTO "AdminCatalogItem" (
            id, "sortOrder", name, "storefrontDescription", variants,
            "itemPlatformProductId", "itemExampleListingUrl", "itemMinPriceCents",
            "itemGoodsServicesCostCents", "itemImageRequirementLabel",
            "itemMinArtworkLongEdgePx", "itemPrintAreaWidthPx", "itemPrintAreaHeightPx", "itemMinArtworkDpi",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, '[]'::jsonb,
            NULL, $5, $6, $7, $8, $9, $10, $11, $12,
            $13::timestamptz, $14::timestamptz
          )`,
          [
            id,
            row.sortOrder,
            row.name,
            row.storefrontDescription,
            row.itemExampleListingUrl,
            row.itemMinPriceCents,
            row.itemGoodsServicesCostCents,
            row.itemImageRequirementLabel,
            row.itemMinArtworkLongEdgePx,
            row.itemPrintAreaWidthPx,
            row.itemPrintAreaHeightPx,
            row.itemMinArtworkDpi,
            now,
            now,
          ],
        );
      }

      let catalogTagLinks = 0;
      for (const link of catalogTags) {
        const itemId = itemKeyToId.get(`${link.itemSortOrder}\0${link.itemName}`);
        if (!itemId) continue;
        const tagRow = await client.query<{ id: string }>(`SELECT id FROM "Tag" WHERE slug = $1`, [
          link.tagSlug,
        ]);
        const tagId = tagRow.rows[0]?.id;
        if (!tagId) continue;
        await client.query(
          `INSERT INTO "AdminCatalogItemTag" ("adminCatalogItemId", "tagId")
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [itemId, tagId],
        );
        catalogTagLinks++;
      }

      await client.query("COMMIT");

      console.log(
        `[copy-admin-config] Done.\n` +
          `  Tags: ${tags.length} source row(s)\n` +
          `  Flairs: ${flairs.length}\n` +
          `  Keywords: ${keywords.length}\n` +
          `  Admin catalog items: ${catalog.length} (no platform product links)\n` +
          `  Catalog↔tag links: ${catalogTagLinks} of ${catalogTags.length}`,
      );
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
