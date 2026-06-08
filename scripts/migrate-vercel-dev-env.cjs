"use strict";

/**
 * Apply Prisma migrations using `.env.local` (Vercel dev pull) when it overrides `.env`.
 * Use when `npm run dev` hits Neon but `npx prisma migrate deploy` only loaded Docker `.env`.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env") });
if (fs.existsSync(path.join(root, ".env.local"))) {
  require("dotenv").config({ path: path.join(root, ".env.local"), override: true });
  console.log("[migrate:local-env] Loaded .env then .env.local (local wins)");
}

const SUFFIX_UNPOOLED = "_DATABASE_URL_UNPOOLED";
const SUFFIX_NON_POOLING = "_POSTGRES_URL_NON_POOLING";

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

function tryDirect(raw) {
  const t = String(raw ?? "").trim();
  if (!t || !isPostgresUrl(t) || isLocalHostUrl(t)) return undefined;
  return t;
}

const url =
  tryDirect(process.env.PRISMA_MIGRATE_DATABASE_URL) ||
  tryDirect(process.env.POSTGRES_URL_NON_POOLING) ||
  tryDirect(process.env.DATABASE_URL_UNPOOLED) ||
  tryDirect(process.env.DIRECT_URL) ||
  (() => {
    for (const [k, v] of Object.entries(process.env)) {
      if (!isPostgresUrl(v) || isLocalHostUrl(String(v).trim())) continue;
      if (
        (k.length > SUFFIX_NON_POOLING.length && k.endsWith(SUFFIX_NON_POOLING)) ||
        (k.length > SUFFIX_UNPOOLED.length && k.endsWith(SUFFIX_UNPOOLED))
      ) {
        return String(v).trim();
      }
    }
    return undefined;
  })() ||
  tryDirect(process.env.DATABASE_URL);

if (!url) {
  console.error("[migrate:local-env] No Postgres URL found in .env / .env.local");
  process.exit(1);
}

let host = "?";
try {
  host = new URL(url).hostname;
} catch {
  /* ignore */
}
console.log(`[migrate:local-env] migrate deploy → ${host}`);

const env = { ...process.env, PRISMA_MIGRATE_DATABASE_URL: url };
delete env.DIRECT_URL;
delete env.DATABASE_URL;

const prismaBin = path.join(root, "node_modules", "prisma", "build", "index.js");
const r = spawnSync(process.execPath, [prismaBin, "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
  stdio: "inherit",
  cwd: root,
  env,
});
process.exit(r.status ?? 1);
