/**
 * Duplicate standard Admin list catalog rows into the secret menu catalog.
 *
 * Usage:
 *   npm run db:copy-admin-catalog-to-secret-menu
 *   SECRET_MENU_COPY_REPLACE=1 npm run db:copy-admin-catalog-to-secret-menu
 */
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.production.local", override: true });

async function main() {
  const replaceExisting = process.env.SECRET_MENU_COPY_REPLACE === "1";
  const { copyStandardAdminCatalogToSecretMenu } = await import(
    "../src/lib/admin-secret-menu-catalog-copy"
  );
  const { prisma } = await import("../src/lib/prisma");

  try {
    const result = await copyStandardAdminCatalogToSecretMenu({ replaceExisting });
    if (!result.ok) {
      console.error(`[copy-admin-catalog-to-secret-menu] ${result.error}`);
      process.exit(1);
    }
    console.log(
      `[copy-admin-catalog-to-secret-menu] Copied ${result.copiedCount} item(s)${replaceExisting ? " (replaced existing secret menu catalog)" : ""}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
