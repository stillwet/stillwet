/**
 * Copy Admin → List data from a remote DB (e.g. production) into the local target DB,
 * remapping `itemPlatformProductId` and per-variant `platformProductId` via `Product.slug`.
 * Also syncs linked `Tag` rows and `AdminCatalogItemTag` associations.
 *
 * Target must be local Postgres (localhost / 127.0.0.1) unless ADMIN_CATALOG_SYNC_CONFIRM=1.
 *
 * Typical:
 *   # .env → local DATABASE_URL
 *   # .env.production.local → production URL (or set ADMIN_CATALOG_SYNC_FROM_URL)
 *   npm run db:sync:admin-catalog
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";

const root = path.join(__dirname, "..");

function loadTargetUrl(): string | undefined {
  dotenv.config({ path: path.join(root, ".env") });
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_PRISMA_URL?.trim();
}

function postgresUrlFromParsedEnv(parsed: Record<string, string>): string | undefined {
  for (const k of [
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "PRISMA_MIGRATE_DATABASE_URL",
  ]) {
    const v = parsed[k]?.trim();
    if (v && (v.startsWith("postgresql://") || v.startsWith("postgres://"))) return v;
  }
  for (const [k, v] of Object.entries(parsed)) {
    const t = v?.trim();
    if (!t || (!t.startsWith("postgresql://") && !t.startsWith("postgres://"))) continue;
    if (k.endsWith("_POSTGRES_PRISMA_URL") || k.endsWith("_DATABASE_URL")) return t;
  }
  return undefined;
}

function loadSourceUrl(): string | undefined {
  if (process.env.ADMIN_CATALOG_SYNC_FROM_URL?.trim()) {
    return process.env.ADMIN_CATALOG_SYNC_FROM_URL.trim();
  }
  const prodPath = path.join(root, ".env.production.local");
  if (!fs.existsSync(prodPath)) return undefined;
  const parsed = dotenv.parse(fs.readFileSync(prodPath));
  return postgresUrlFromParsedEnv(parsed);
}

function isLocalTargetUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
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

function maskHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid)";
  }
}

function newRowId(): string {
  return randomBytes(12).toString("base64url").slice(0, 25);
}

/** Reject placeholders and malformed URLs before `pg` (avoids opaque getaddrinfo EINVAL). */
function assertValidPostgresUrl(label: string, url: string): void {
  const t = url.trim();
  if (!t.startsWith("postgresql://") && !t.startsWith("postgres://")) {
    console.error(`[sync-admin-catalog] ${label} must start with postgresql:// or postgres://`);
    process.exit(1);
  }
  let host: string;
  try {
    host = new URL(t).hostname;
  } catch {
    console.error(`[sync-admin-catalog] ${label} is not a valid URL (check quotes and special characters).`);
    process.exit(1);
  }
  if (!host || host === "…" || host.includes("\u2026")) {
    console.error(
      `[sync-admin-catalog] ${label} has an invalid hostname "${host}". Paste the real connection string from Vercel or Neon — not an ellipsis placeholder.`,
    );
    process.exit(1);
  }
  if (host.length < 3 || /^\.+$/.test(host)) {
    console.error(`[sync-admin-catalog] ${label} hostname looks wrong: "${host}"`);
    process.exit(1);
  }
}

type AdminRow = {
  sortOrder: number;
  name: string;
  storefrontDescription: string | null;
  variants: unknown;
  itemPlatformProductId: string | null;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
  itemGoodsServicesCostCents: number;
  itemImageRequirementLabel: string | null;
  itemMinArtworkLongEdgePx: number | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
  itemMinArtworkDpi: number | null;
  itemLargeListingArtwork: boolean;
};

function remapVariantJson(
  variants: unknown,
  sourceProductIdToSlug: Map<string, string>,
  targetSlugToProductId: Map<string, string>,
): unknown {
  if (!Array.isArray(variants)) return [];
  return variants.map((v) => {
    if (!v || typeof v !== "object") return v;
    const o = { ...(v as Record<string, unknown>) };
    const pid = typeof o.platformProductId === "string" ? o.platformProductId.trim() : "";
    if (pid) {
      const slug = sourceProductIdToSlug.get(pid);
      o.platformProductId = slug ? (targetSlugToProductId.get(slug) ?? "") : "";
    }
    return o;
  });
}

async function main() {
  const targetUrl = loadTargetUrl();
  const sourceUrl = loadSourceUrl();

  if (!targetUrl) {
    console.error("[sync-admin-catalog] Missing target DATABASE_URL in .env");
    process.exit(1);
  }
  if (!sourceUrl) {
    console.error(
      "[sync-admin-catalog] Missing source URL. Set ADMIN_CATALOG_SYNC_FROM_URL or add .env.production.local with POSTGRES_PRISMA_URL / DATABASE_URL.",
    );
    process.exit(1);
  }
  if (normalizeUrl(sourceUrl) === normalizeUrl(targetUrl)) {
    console.error("[sync-admin-catalog] Source and target URLs are the same; refusing.");
    process.exit(1);
  }
  if (!isLocalTargetUrl(targetUrl) && process.env.ADMIN_CATALOG_SYNC_CONFIRM !== "1") {
    console.error(
      "[sync-admin-catalog] Target DATABASE_URL is not local (localhost/127.0.0.1). To overwrite a non-local DB, set ADMIN_CATALOG_SYNC_CONFIRM=1.",
    );
    process.exit(1);
  }

  assertValidPostgresUrl("Source (ADMIN_CATALOG_SYNC_FROM_URL or .env.production.local)", sourceUrl);
  assertValidPostgresUrl("Target (.env DATABASE_URL)", targetUrl);

  console.log(`[sync-admin-catalog] Source host: ${maskHost(sourceUrl)}`);
  console.log(`[sync-admin-catalog] Target host: ${maskHost(targetUrl)}`);

  const sourcePool = new pg.Pool({ connectionString: sourceUrl });
  const targetPool = new pg.Pool({ connectionString: targetUrl });

  try {
    const { rows: sourceProducts } = await sourcePool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM "Product"`,
    );
    const sourceIdToSlug = new Map(sourceProducts.map((p) => [p.id, p.slug]));

    const { rows: targetProducts } = await targetPool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM "Product"`,
    );
    const targetSlugToId = new Map(targetProducts.map((p) => [p.slug, p.id]));

    const { rows: sourceItems } = await sourcePool.query<{
      sortOrder: number;
      name: string;
      storefrontDescription: string | null;
      variants: unknown;
      itemPlatformProductId: string | null;
      itemExampleListingUrl: string | null;
      itemMinPriceCents: number;
      itemGoodsServicesCostCents: number;
      itemImageRequirementLabel: string | null;
      itemMinArtworkLongEdgePx: number | null;
      itemPrintAreaWidthPx: number | null;
      itemPrintAreaHeightPx: number | null;
      itemMinArtworkDpi: number | null;
      itemLargeListingArtwork: boolean;
    }>(
      `SELECT "sortOrder", name, "storefrontDescription", variants, "itemPlatformProductId",
              "itemExampleListingUrl", "itemMinPriceCents", "itemGoodsServicesCostCents",
              "itemImageRequirementLabel", "itemMinArtworkLongEdgePx", "itemPrintAreaWidthPx",
              "itemPrintAreaHeightPx", "itemMinArtworkDpi", "itemLargeListingArtwork"
       FROM "AdminCatalogItem"
       ORDER BY "sortOrder" ASC, "createdAt" ASC`,
    );

    if (sourceItems.length === 0) {
      console.log("[sync-admin-catalog] Source has 0 admin catalog rows; leaving target unchanged.");
      return;
    }

    const { rows: catalogTags } = await sourcePool.query<{
      itemSortOrder: number;
      itemName: string;
      tagSlug: string;
      tagName: string;
      tagSortOrder: number;
    }>(
      `SELECT i."sortOrder" AS "itemSortOrder", i.name AS "itemName", t.slug AS "tagSlug",
              t.name AS "tagName", t."sortOrder" AS "tagSortOrder"
       FROM "AdminCatalogItemTag" ct
       JOIN "AdminCatalogItem" i ON i.id = ct."adminCatalogItemId"
       JOIN "Tag" t ON t.id = ct."tagId"
       ORDER BY i."sortOrder", t.slug`,
    );

    const mapped: AdminRow[] = [];
    for (const row of sourceItems) {
      let itemPlatformProductId: string | null = null;
      if (row.itemPlatformProductId) {
        const slug = sourceIdToSlug.get(row.itemPlatformProductId);
        itemPlatformProductId = slug ? targetSlugToId.get(slug) ?? null : null;
      }
      const variants = remapVariantJson(row.variants, sourceIdToSlug, targetSlugToId);
      mapped.push({
        sortOrder: row.sortOrder,
        name: row.name,
        storefrontDescription: row.storefrontDescription,
        variants,
        itemPlatformProductId,
        itemExampleListingUrl: row.itemExampleListingUrl,
        itemMinPriceCents: row.itemMinPriceCents,
        itemGoodsServicesCostCents: row.itemGoodsServicesCostCents,
        itemImageRequirementLabel: row.itemImageRequirementLabel,
        itemMinArtworkLongEdgePx: row.itemMinArtworkLongEdgePx,
        itemPrintAreaWidthPx: row.itemPrintAreaWidthPx,
        itemPrintAreaHeightPx: row.itemPrintAreaHeightPx,
        itemMinArtworkDpi: row.itemMinArtworkDpi,
        itemLargeListingArtwork: row.itemLargeListingArtwork,
      });
    }

    const tagsBySlug = new Map<string, { name: string; sortOrder: number }>();
    for (const link of catalogTags) {
      if (!tagsBySlug.has(link.tagSlug)) {
        tagsBySlug.set(link.tagSlug, { name: link.tagName, sortOrder: link.tagSortOrder });
      }
    }

    const client = await targetPool.connect();
    try {
      await client.query("BEGIN");
      const now = new Date().toISOString();

      for (const [slug, tag] of tagsBySlug) {
        await client.query(
          `INSERT INTO "Tag" (id, slug, name, "sortOrder", "byItemSpotlightProductId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, NULL, $5::timestamptz, $6::timestamptz)
           ON CONFLICT (slug) DO UPDATE SET
             name = EXCLUDED.name,
             "sortOrder" = EXCLUDED."sortOrder",
             "updatedAt" = EXCLUDED."updatedAt"`,
          [newRowId(), slug, tag.name, tag.sortOrder, now, now],
        );
      }

      await client.query(`DELETE FROM "AdminCatalogItemTag"`);
      await client.query(`DELETE FROM "AdminCatalogItem"`);

      const itemKeyToId = new Map<string, string>();
      for (const m of mapped) {
        const id = newRowId();
        const key = `${m.sortOrder}\0${m.name}`;
        itemKeyToId.set(key, id);
        await client.query(
          `INSERT INTO "AdminCatalogItem" (
            id, "sortOrder", name, "storefrontDescription", variants,
            "itemPlatformProductId", "itemExampleListingUrl", "itemMinPriceCents",
            "itemGoodsServicesCostCents", "itemImageRequirementLabel",
            "itemMinArtworkLongEdgePx", "itemPrintAreaWidthPx", "itemPrintAreaHeightPx", "itemMinArtworkDpi",
            "itemLargeListingArtwork",
            "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16::timestamptz, $17::timestamptz
          )`,
          [
            id,
            m.sortOrder,
            m.name,
            m.storefrontDescription,
            JSON.stringify(m.variants ?? []),
            m.itemPlatformProductId,
            m.itemExampleListingUrl,
            m.itemMinPriceCents,
            m.itemGoodsServicesCostCents,
            m.itemImageRequirementLabel,
            m.itemMinArtworkLongEdgePx,
            m.itemPrintAreaWidthPx,
            m.itemPrintAreaHeightPx,
            m.itemMinArtworkDpi,
            m.itemLargeListingArtwork,
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
        `[sync-admin-catalog] Done.\n` +
          `  Admin catalog items: ${mapped.length}\n` +
          `  Tags upserted: ${tagsBySlug.size}\n` +
          `  Catalog↔tag links: ${catalogTagLinks} of ${catalogTags.length}`,
      );
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
