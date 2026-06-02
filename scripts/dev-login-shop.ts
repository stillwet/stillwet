/**
 * Local dev: open the app's dev login route (same DB + iron-session cookies as `npm run dev`).
 *
 * Usage:
 *   npx tsx scripts/dev-login-shop.ts [shop-slug]
 *
 * Default slug: xtina-test
 *
 * Requires `npm run dev` on port 3000.
 */
import { config } from "dotenv";
import { execSync } from "child_process";

config({ path: ".env.development.local" });
config({ path: ".env.local" });
config({ path: ".env" });

const DEFAULT_SLUG = "xtina-test";
const APP = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

async function main() {
  const slug = encodeURIComponent(String(process.argv[2] ?? DEFAULT_SLUG).trim());
  const loginUrl = `${APP.replace(/\/$/, "")}/api/dev/shop-login?slug=${slug}`;

  console.info(`Open in the same browser you use for the shop (sets cookies on ${APP}):`);
  console.info(loginUrl);

  try {
    execSync(`start "" "${loginUrl}"`, { stdio: "ignore", shell: "cmd.exe" });
  } catch {
    console.info("Could not auto-open browser — paste the URL above.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
