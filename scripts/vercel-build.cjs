"use strict";

/**
 * Vercel / CI build: **no database calls** — only Prisma Client generation + Next.js.
 *
 * `prisma migrate deploy` / `db push` during `npm run build` fails often on Vercel (pooler,
 * network, Prisma engine). Apply schema separately (see VERCEL.md).
 *
 * Optional: set RUN_PRISMA_SCHEMA_ON_BUILD=1 to run migrate, then db push on failure.
 *
 * On Vercel, restored `.next` build cache can leave the directory in a bad state (e.g.
 * `ENOENT: lstat '.next/lock'`). By default we reset `.next` when running on Vercel before
 * `next build`. Set `SKIP_CLEAN_NEXT_ON_VERCEL=1` to skip (only if debugging).
 *
 * Detection: `VERCEL=1` / `VERCEL=true`, or `VERCEL_ENV` together with `CI=true` (Vercel sets
 * both during builds). We avoid relying on `VERCEL_ENV` alone so a stray `.env` copy does not
 * wipe `.next` on a developer machine.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync, spawnSync } = require("node:child_process");

function shouldCleanNextForVercel() {
  if (process.env.SKIP_CLEAN_NEXT_ON_VERCEL === "1") return false;
  const v = process.env.VERCEL;
  if (v === "1" || v === "true") return true;
  // Present on Vercel build workers even when `VERCEL` is missing from a subprocess edge case.
  if (Boolean(process.env.VERCEL_REGION?.trim())) return true;
  if (Boolean(process.env.VERCEL_ENV?.trim()) && process.env.CI === "true") return true;
  return false;
}

/** Remove cached `.next`, then ensure an empty `.next` dir exists so Next can create `lock` cleanly. */
function resetNextDirOnVercel(label) {
  if (!shouldCleanNextForVercel()) return;
  const nextDir = path.join(process.cwd(), ".next");
  if (fs.existsSync(nextDir)) {
    console.log(`[build] ${label} — removing .next (stale Vercel cache / lock)`);
    fs.rmSync(nextDir, { recursive: true, force: true });
  }
  fs.mkdirSync(nextDir, { recursive: true });
}

function run(cmd) {
  console.log(`[build] ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env, shell: true });
  } catch (e) {
    if (e && typeof e === "object" && e.status != null) {
      console.error(`[build] Command failed (exit ${e.status}): ${cmd}`);
    }
    throw e;
  }
}

function isPostgresUrl(v) {
  const t = String(v ?? "").trim();
  return t.startsWith("postgresql://") || t.startsWith("postgres://");
}

function isLocalDatabaseHost(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return true;
  }
}

/** Mirrors src/lib/env-postgres-url.ts — must stay in sync for Vercel preflight. */
function resolveVercelBuildDatabaseUrl() {
  const localhostKeys = [];
  const standardKeys = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL", "DIRECT_URL"];
  for (const key of standardKeys) {
    const raw = process.env[key]?.trim();
    if (!raw || !isPostgresUrl(raw)) continue;
    if (isLocalDatabaseHost(raw)) {
      localhostKeys.push(key);
      continue;
    }
    return { ok: true, key };
  }

  const integrated = [];
  for (const [k, v] of Object.entries(process.env)) {
    const raw = String(v ?? "").trim();
    if (!raw || !isPostgresUrl(raw) || isLocalDatabaseHost(raw)) continue;
    if (
      (k.length > "_POSTGRES_PRISMA_URL".length && k.endsWith("_POSTGRES_PRISMA_URL")) ||
      (k.length > "_DATABASE_URL".length && k.endsWith("_DATABASE_URL"))
    ) {
      integrated.push(k);
    }
  }
  integrated.sort();
  if (integrated.length > 0) {
    return { ok: true, key: integrated[0] };
  }

  return { ok: false, localhostKeys };
}

function logVercelServerActionsEnvHint() {
  if (!shouldCleanNextForVercel()) return;
  if (process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim()) {
    console.log("[build] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is set (Server Action ids stable across instances).");
    return;
  }
  console.warn(
    "[build] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is not set. Server Action ids change each build; after deploy, " +
      "users with an old admin tab may see 'Server Action was not found'. Set a stable base64 AES key in Vercel " +
      "Production + Preview (available at build time), or enable Skew Protection — see VERCEL.md.",
  );
}

function logVercelDatabaseEnvDiagnostics() {
  if (!shouldCleanNextForVercel()) return;

  const dbRelatedKeys = Object.keys(process.env)
    .filter((k) => /POSTGRES|DATABASE|NEON|PRISMA/i.test(k))
    .sort();
  console.log(
    `[build] Database-related env keys on this worker: ${dbRelatedKeys.join(", ") || "(none)"}`,
  );

  const resolved = resolveVercelBuildDatabaseUrl();
  if (resolved.ok) {
    console.log(`[build] Postgres URL resolved for build/runtime (${resolved.key})`);
    return;
  }

  const lines = [
    "",
    "========== BUILD WARN (database env) ==========",
    "No reachable Postgres URL on this Vercel worker.",
    "Build will continue; fix Production env before the site can serve data.",
  ];
  if (resolved.localhostKeys.length > 0) {
    lines.push(
      `Ignored localhost vars: ${resolved.localhostKeys.join(", ")} (Docker — not reachable on Vercel).`,
    );
  }
  lines.push(
    "Fix: Vercel project that owns stillwet.com → Settings → Environment Variables → Production:",
    "  • Delete DATABASE_URL if it is postgresql://…@127.0.0.1:5432/…",
    "  • Link Neon (Storage) OR set POSTGRES_PRISMA_URL to your Neon pooled URL",
    "  • Set NEXT_PUBLIC_APP_URL=https://stillwet.com",
    "After deploy, open /api/health — database.ok must be true.",
    "===============================================",
    "",
  );
  for (const line of lines) console.warn(`[build] ${line}`);
}

function runOptionalSchemaSync() {
  if (process.env.RUN_PRISMA_SCHEMA_ON_BUILD !== "1") {
    console.log(
      "[build] DB schema sync skipped (default). After deploy, apply schema once — VERCEL.md § Database schema",
    );
    return;
  }

  process.env.CI = process.env.CI || "true";
  console.log("[build] RUN_PRISMA_SCHEMA_ON_BUILD=1 — prisma migrate deploy");
  let code =
    spawnSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
      stdio: "inherit",
      env: process.env,
      shell: true,
    }).status ?? 1;
  if (code !== 0) {
    console.warn("[build] migrate deploy failed — prisma db push --skip-generate");
    code =
      spawnSync("npx prisma db push --skip-generate --schema prisma/schema.prisma", {
        stdio: "inherit",
        env: process.env,
        shell: true,
      }).status ?? 1;
    if (code !== 0) {
      process.exit(code);
    }
  }
}

resetNextDirOnVercel("before prisma generate");

logVercelDatabaseEnvDiagnostics();
logVercelServerActionsEnvHint();

run("npx prisma generate --schema prisma/schema.prisma");
runOptionalSchemaSync();

// Next 16 defaults to Turbopack for `next build`; this repo sets `webpack()` in next.config.ts
// (chunk load timeout in dev client bundle). Explicit --webpack is required or the build errors.
resetNextDirOnVercel("before next build");
run("npx next build --webpack");
