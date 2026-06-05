/**
 * Delete every R2 object except site/still-wet-logo-2048.png (transactional email logo).
 *
 * Usage:
 *   npx tsx scripts/r2-purge-all-except-site-logo.ts           # dry-run
 *   npx tsx scripts/r2-purge-all-except-site-logo.ts --execute # delete
 *
 * Production:
 *   node scripts/with-production-env.cjs node_modules/tsx/dist/cli.mjs scripts/r2-purge-all-except-site-logo.ts --execute
 */

import { config } from "dotenv";
import { isR2UploadConfigured, readR2BucketName, readR2Env } from "../src/lib/r2-upload";
import { purgeAllR2ExceptSiteLogo } from "../src/lib/r2-purge-all-except-site-logo";
import { SITE_EMAIL_LOGO_R2_OBJECT_KEY } from "../src/lib/site-email-logo-constants";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const execute = process.argv.includes("--execute");
  if (!isR2UploadConfigured()) {
    console.error("[r2-purge] R2 is not configured.");
    process.exit(1);
  }

  console.log("[r2-purge] bucket:", readR2BucketName() ?? "(missing)");
  console.log("[r2-purge] keep key:", SITE_EMAIL_LOGO_R2_OBJECT_KEY);
  console.log("[r2-purge] public base:", readR2Env("R2_PUBLIC_BASE_URL")?.trim() ?? "(unset)");
  console.log(execute ? "[r2-purge] Deleting…" : "[r2-purge] Dry run…");

  const r = await purgeAllR2ExceptSiteLogo({ dryRun: !execute });

  console.log(
    JSON.stringify(
      {
        totalObjectCount: r.totalObjectCount,
        keptKeys: r.keptKeys,
        targetKeyCount: r.targetKeyCount,
        deletedCount: r.deletedCount,
        targetKeysSample: r.targetKeysSample,
      },
      null,
      2,
    ),
  );

  if (r.targetKeyCount === 0) {
    console.log("[r2-purge] Nothing to delete.");
    return;
  }

  if (!execute) {
    console.log("\n[r2-purge] Re-run with --execute to delete.");
  } else {
    console.log(`[r2-purge] Deleted ${r.deletedCount} of ${r.targetKeyCount} object(s).`);
  }
}

void main().catch((e) => {
  console.error("[r2-purge] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
