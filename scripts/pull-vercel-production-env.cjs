"use strict";

/**
 * Pull Vercel Production env vars locally and sync `.env` to match.
 *
 * Requires: `npx vercel login` and `npx vercel link` in this repo.
 *
 * Usage: node scripts/pull-vercel-production-env.cjs
 *        npm run env:pull:prod
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const productionLocalRel = ".env.production.local";
const productionLocal = path.join(root, productionLocalRel);
const dotEnv = path.join(root, ".env");

function fail(msg) {
  console.error(`[env:pull:prod] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(root, ".vercel", "project.json"))) {
  fail("No .vercel/project.json — run `npx vercel link` in the repo root first.");
}

console.log("[env:pull:prod] vercel env pull → .env.production.local (production)");
const pull = spawnSync(
  "npx",
  ["vercel", "env", "pull", productionLocalRel, "--environment", "production", "--yes"],
  { cwd: root, stdio: "inherit", shell: true },
);
if ((pull.status ?? 1) !== 0) {
  process.exit(pull.status ?? 1);
}

if (!fs.existsSync(productionLocal)) {
  fail("Pull finished but .env.production.local was not created.");
}

fs.copyFileSync(productionLocal, dotEnv);
console.log("[env:pull:prod] Copied .env.production.local → .env");
console.log("[env:pull:prod] Restart `npm run dev` to reload env (.env.local still overrides).");
