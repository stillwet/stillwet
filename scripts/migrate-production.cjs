"use strict";

/**
 * Apply Prisma migrations to production Neon (direct / non-pooling URL).
 *
 * Loads `.env.production.local` (from `vercel env pull --environment production`).
 * Forces `PRISMA_MIGRATE_DATABASE_URL` so a leftover local `DIRECT_URL` in that file
 * cannot send migrations to localhost.
 *
 * Usage: npm run db:migrate:prod
 *
 * Manual resolve (same Neon direct URL as deploy):
 *   node scripts/migrate-production.cjs resolve-applied MIGRATION_DIR_NAME
 *   node scripts/migrate-production.cjs resolve-rolled-back MIGRATION_DIR_NAME
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const envLoadOrder = [
  path.join(root, ".env.production.local"),
  path.join(root, ".env"),
  path.join(root, ".env.neon-verify"),
];

const loaded = [];
for (const file of envLoadOrder) {
  if (!fs.existsSync(file)) continue;
  require("dotenv").config({ path: file, override: true });
  loaded.push(path.basename(file));
}
if (loaded.length === 0) {
  console.error(
    "[migrate:prod] No .env.production.local, .env, or .env.neon-verify found.\n" +
      "  Paste Neon POSTGRES_URL_NON_POOLING into .env or run: npx vercel env pull .env.production.local --environment production",
  );
  process.exit(1);
}
console.log(`[migrate:prod] Loaded env from: ${loaded.join(" → ")} (last wins)`);

const SUFFIX_NON_POOLING = "_POSTGRES_URL_NON_POOLING";
const SUFFIX_UNPOOLED = "_DATABASE_URL_UNPOOLED";

function isPostgresUrl(v) {
  const t = String(v ?? "").trim();
  return t.startsWith("postgresql://") || t.startsWith("postgres://");
}

function isLocalHostUrl(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return true;
  }
}

function tryDirectCandidate(raw) {
  const t = String(raw ?? "").trim();
  if (!t || !isPostgresUrl(t) || isLocalHostUrl(t)) return undefined;
  return t;
}

/** Vercel + Neon integration injects prefixed vars (e.g. `stillwet_POSTGRES_URL_NON_POOLING`). */
function integrationDirectUrlFromEnv() {
  const found = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!isPostgresUrl(v)) continue;
    if (isLocalHostUrl(String(v).trim())) continue;
    if (
      (k.length > SUFFIX_NON_POOLING.length && k.endsWith(SUFFIX_NON_POOLING)) ||
      (k.length > SUFFIX_UNPOOLED.length && k.endsWith(SUFFIX_UNPOOLED))
    ) {
      found.push({ key: k, url: String(v).trim() });
    }
  }
  if (found.length === 0) return undefined;
  found.sort((a, b) => a.key.localeCompare(b.key));
  if (found.length > 1) {
    console.log(`[migrate:prod] Multiple integration direct URLs; using ${found[0].key}`);
  }
  return found[0].url;
}

const url =
  tryDirectCandidate(process.env.PRISMA_MIGRATE_DATABASE_URL) ||
  tryDirectCandidate(process.env.POSTGRES_URL_NON_POOLING) ||
  tryDirectCandidate(process.env.DATABASE_URL_UNPOOLED) ||
  tryDirectCandidate(process.env.DIRECT_URL) ||
  integrationDirectUrlFromEnv();

if (!url) {
  console.error(
    "[migrate:prod] No non-local direct Postgres URL found.\n  Set POSTGRES_URL_NON_POOLING in .env.neon-verify, .env, or .env.production.local (Neon direct / unpooled URL).",
  );
  process.exit(1);
}

const env = { ...process.env, PRISMA_MIGRATE_DATABASE_URL: url };
delete env.DIRECT_URL;
delete env.DATABASE_URL;

const prismaBin = path.join(root, "node_modules", "prisma", "build", "index.js");

const argv = process.argv.slice(2);
if (argv[0] === "resolve-applied" && argv[1]) {
  const name = argv[1];
  console.log(`[migrate:prod] prisma migrate resolve --applied ${name} (Neon direct URL)`);
  const r = spawnSync(
    process.execPath,
    [prismaBin, "migrate", "resolve", "--applied", name, "--schema", "prisma/schema.prisma"],
    { stdio: "inherit", cwd: root, env },
  );
  process.exit(r.status ?? 1);
}
if (argv[0] === "resolve-rolled-back" && argv[1]) {
  const name = argv[1];
  console.log(`[migrate:prod] prisma migrate resolve --rolled-back ${name} (Neon direct URL)`);
  const r = spawnSync(
    process.execPath,
    [prismaBin, "migrate", "resolve", "--rolled-back", name, "--schema", "prisma/schema.prisma"],
    { stdio: "inherit", cwd: root, env },
  );
  process.exit(r.status ?? 1);
}

console.log("[migrate:prod] Using Neon direct URL for prisma migrate deploy");

const r = spawnSync(process.execPath, [prismaBin, "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
  stdio: "inherit",
  cwd: root,
  env,
});
process.exit(r.status ?? 1);
