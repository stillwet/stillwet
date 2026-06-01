"use strict";

/**
 * Verify Neon Postgres before Vercel re-integration.
 *
 * 1. Copy env.neon-verify.example → .env.neon-verify
 * 2. Paste pooled + direct URLs from Neon console (Connection details)
 * 3. npm run db:verify-neon
 *
 * Does not touch Vercel. Does not run migrations unless you pass --migrate.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
/** Later files override earlier (highest priority last). */
const envLoadOrder = [
  path.join(root, ".env.production.local"),
  path.join(root, ".env"),
  path.join(root, ".env.neon-verify"),
];

function loadEnvFiles() {
  const loaded = [];
  for (const file of envLoadOrder) {
    if (!fs.existsSync(file)) continue;
    require("dotenv").config({ path: file, override: true });
    loaded.push(path.basename(file));
  }
  return loaded;
}

function isPostgresUrl(v) {
  const t = String(v ?? "").trim();
  return t.startsWith("postgresql://") || t.startsWith("postgres://");
}

function isLocalHost(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return true;
  }
}

function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(invalid url)";
  }
}

function findPooledUrl() {
  const standard = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"].map((key) => {
    const v = process.env[key]?.trim();
    return v && isPostgresUrl(v) ? { key, url: v } : null;
  });
  const hit = standard.find(Boolean);
  if (hit) return hit;

  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.trim() || !isPostgresUrl(v)) continue;
    if (k.endsWith("_POSTGRES_PRISMA_URL") || (k.endsWith("_DATABASE_URL") && !k.endsWith("_UNPOOLED"))) {
      return { key: k, url: v.trim() };
    }
  }
  return null;
}

function findDirectUrl() {
  const standard = ["POSTGRES_URL_NON_POOLING", "DATABASE_URL_UNPOOLED", "DIRECT_URL", "PRISMA_MIGRATE_DATABASE_URL"].map(
    (key) => {
      const v = process.env[key]?.trim();
      return v && isPostgresUrl(v) ? { key, url: v } : null;
    },
  );
  const hit = standard.find(Boolean);
  if (hit) return hit;

  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.trim() || !isPostgresUrl(v)) continue;
    if (k.endsWith("_POSTGRES_URL_NON_POOLING") || k.endsWith("_DATABASE_URL_UNPOOLED")) {
      return { key: k, url: v.trim() };
    }
  }
  return null;
}

async function ping(label, connectionString) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 15_000,
  });
  try {
    const res = await pool.query("SELECT 1 AS ok");
    return { ok: true, row: res.rows[0] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await pool.end().catch(() => {});
  }
}

function looksLikeNeonHost(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes("neon.tech");
  } catch {
    return false;
  }
}

function looksLikePooled(url) {
  try {
    return new URL(url).hostname.toLowerCase().includes("-pooler");
  } catch {
    return false;
  }
}

async function main() {
  const loaded = loadEnvFiles();
  if (loaded.length === 0) {
    console.error(
      "[verify-neon] No .env, .env.neon-verify, or .env.production.local found.\n" +
        "  Paste Neon URLs into .env.neon-verify (see env.neon-verify.example) or at the bottom of .env.",
    );
    process.exit(1);
  }
  console.log(`[verify-neon] Loaded env from: ${loaded.join(" → ")} (last wins)`);

  const pooled = findPooledUrl();
  const direct = findDirectUrl();

  let failed = false;

  if (!pooled) {
    console.error("[verify-neon] FAIL — no pooled URL (set POSTGRES_PRISMA_URL or DATABASE_URL)");
    failed = true;
  } else {
    if (isLocalHost(pooled.url)) {
      console.error(`[verify-neon] FAIL — ${pooled.key} is localhost (use Neon, not Docker)`);
      failed = true;
    } else {
      console.log(`[verify-neon] Pooled (${pooled.key}): ${maskUrl(pooled.url)}`);
      if (!looksLikeNeonHost(pooled.url)) {
        console.warn("[verify-neon] WARN — hostname does not contain neon.tech (still testing)");
      }
      if (!looksLikePooled(pooled.url)) {
        console.warn("[verify-neon] WARN — pooled URL usually has -pooler in hostname (runtime on Vercel is OK either way)");
      }
      const r = await ping("pooled", pooled.url);
      if (r.ok) console.log("[verify-neon] OK — pooled SELECT 1");
      else {
        console.error("[verify-neon] FAIL — pooled connect:", r.error);
        failed = true;
      }
    }
  }

  if (!direct) {
    console.error(
      "[verify-neon] FAIL — no direct URL (set POSTGRES_URL_NON_POOLING for migrations)",
    );
    failed = true;
  } else {
    if (isLocalHost(direct.url)) {
      console.error(`[verify-neon] FAIL — ${direct.key} is localhost`);
      failed = true;
    } else {
      console.log(`[verify-neon] Direct (${direct.key}): ${maskUrl(direct.url)}`);
      const r = await ping("direct", direct.url);
      if (r.ok) console.log("[verify-neon] OK — direct SELECT 1");
      else {
        console.error("[verify-neon] FAIL — direct connect:", r.error);
        failed = true;
      }
    }
  }

  if (!failed && direct) {
    console.log("[verify-neon] Checking migration history (prisma migrate status)…");
    const env = { ...process.env, PRISMA_MIGRATE_DATABASE_URL: direct.url };
    delete env.DATABASE_URL;
    delete env.DIRECT_URL;
    const prismaBin = path.join(root, "node_modules", "prisma", "build", "index.js");
    const st = spawnSync(
      process.execPath,
      [prismaBin, "migrate", "status", "--schema", "prisma/schema.prisma"],
      { encoding: "utf8", cwd: root, env },
    );
    const out = `${st.stdout ?? ""}\n${st.stderr ?? ""}`;
    if (st.status !== 0 && !/have not yet been applied/i.test(out)) {
      console.error("[verify-neon] migrate status failed:", out.slice(0, 400));
      failed = true;
    } else if (/have not yet been applied/i.test(out)) {
      console.log(
        "[verify-neon] OK — connected; schema not applied yet (expected on new Neon). Run: npm run db:migrate:prod",
      );
    } else {
      console.log("[verify-neon] OK — migration history matches repo");
    }
  }

  if (process.argv.includes("--migrate")) {
    if (failed) {
      console.error("[verify-neon] Skipping migrate — fix connection errors first");
      process.exit(1);
    }
    console.log("[verify-neon] Running prisma migrate deploy…");
    const r = spawnSync("npm", ["run", "db:migrate:prod"], { stdio: "inherit", cwd: root, shell: true });
    process.exit(r.status ?? 1);
  }

  if (failed) {
    console.error("\n[verify-neon] Not ready for Vercel — fix errors above");
    process.exit(1);
  }

  console.log("\n[verify-neon] Neon looks good. Safe to add to Vercel Production:");
  console.log("  POSTGRES_PRISMA_URL     ← pooled URL");
  console.log("  POSTGRES_URL_NON_POOLING ← direct URL (migrations)");
  console.log("Then redeploy and check https://stillwet.com/api/health");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
