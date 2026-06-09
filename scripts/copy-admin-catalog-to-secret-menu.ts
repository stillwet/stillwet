/**
 * Import Admin list catalog rows missing from the secret menu (matched by name).
 *
 * Usage:
 *   npm run db:copy-admin-catalog-to-secret-menu
 */
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.production.local", override: true });

async function main() {
  const { importAllMissingStandardAdminCatalogToSecretMenu } = await import(
    "../src/lib/admin-secret-menu-catalog-copy"
  );
  const { prisma } = await import("../src/lib/prisma");

  try {
    const result = await importAllMissingStandardAdminCatalogToSecretMenu();
    if (!result.ok) {
      console.error(`[copy-admin-catalog-to-secret-menu] ${result.error}`);
      process.exit(1);
    }
    console.log(
      `[copy-admin-catalog-to-secret-menu] Imported ${result.copiedCount} item(s)${
        result.skippedAlreadyPresentCount > 0
          ? ` (${result.skippedAlreadyPresentCount} skipped — already in secret menu)`
          : ""
      }.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
