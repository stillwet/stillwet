/**
 * Upload `public/still-wet-logo-2048.png` to R2 for transactional email headers.
 *
 * Requires R2_* env (same as listing uploads). Object key: site/still-wet-logo-2048.png
 *
 * Usage:
 *   npx tsx scripts/upload-site-email-logo-to-r2.ts
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import {
  isR2UploadConfigured,
  putPublicR2Object,
  readR2Env,
} from "../src/lib/r2-upload";
import {
  SITE_EMAIL_LOGO_R2_OBJECT_KEY,
  siteEmailLogoR2PublicUrl,
} from "../src/lib/site-email-logo-url";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const SOURCE = path.join(__dirname, "..", "public", "still-wet-logo-2048.png");

async function main() {
  if (!isR2UploadConfigured()) {
    console.error(
      "[upload-site-email-logo] R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL, and R2_ACCOUNT_ID (or R2_ENDPOINT).",
    );
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE)) {
    console.error(`[upload-site-email-logo] Missing source file: ${SOURCE}`);
    process.exit(1);
  }

  const body = fs.readFileSync(SOURCE);
  const url = await putPublicR2Object({
    key: SITE_EMAIL_LOGO_R2_OBJECT_KEY,
    body,
    contentType: "image/png",
  });

  console.log(`[upload-site-email-logo] Uploaded ${body.length} bytes to ${url}`);
  console.log(
    `[upload-site-email-logo] Outbound emails use this URL when R2_PUBLIC_BASE_URL=${readR2Env("R2_PUBLIC_BASE_URL") ?? "(set)"}.`,
  );
  console.log(
    `[upload-site-email-logo] Resolved URL: ${siteEmailLogoR2PublicUrl() ?? url}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
