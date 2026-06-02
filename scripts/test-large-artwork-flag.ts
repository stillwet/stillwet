/**
 * Verify AdminCatalogItem.itemLargeListingArtwork read/write.
 * Usage: npx tsx scripts/test-large-artwork-flag.ts
 * Prod:  node scripts/with-production-env.cjs node_modules/tsx/dist/cli.mjs scripts/test-large-artwork-flag.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const item = await prisma.adminCatalogItem.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, itemLargeListingArtwork: true },
  });
  if (!item) {
    console.log("No catalog items");
    return;
  }
  const before = item.itemLargeListingArtwork;
  console.log("Before:", item);

  const updated = await prisma.adminCatalogItem.update({
    where: { id: item.id },
    data: { itemLargeListingArtwork: true },
    select: { id: true, name: true, itemLargeListingArtwork: true },
  });
  console.log("Set true:", updated);

  const reverted = await prisma.adminCatalogItem.update({
    where: { id: item.id },
    data: { itemLargeListingArtwork: before },
    select: { id: true, name: true, itemLargeListingArtwork: true },
  });
  console.log("Reverted:", reverted);
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
