/**
 * Clear paid shop flair access for a shop (ops). Clears flairPurchasedAt + flairTypeId.
 *
 * Usage: npx tsx scripts/clear-shop-flair.ts "xtina test"
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const needle = String(process.argv[2] ?? "").trim();
  if (!needle) {
    console.error('Usage: npx tsx scripts/clear-shop-flair.ts "<shop name or slug fragment>"');
    process.exit(1);
  }

  const shops = await prisma.shop.findMany({
    where: {
      OR: [
        { displayName: { contains: needle, mode: "insensitive" } },
        { slug: { contains: needle.replace(/\s+/g, "-"), mode: "insensitive" } },
        { slug: { contains: needle, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      slug: true,
      displayName: true,
      flairPurchasedAt: true,
      flairTypeId: true,
      flairType: { select: { label: true } },
    },
  });

  if (shops.length === 0) {
    console.error(`No shop matching "${needle}"`);
    process.exit(1);
  }

  if (shops.length > 1) {
    console.log("Multiple matches — pass a more specific name:");
    for (const s of shops) {
      console.log(`  - ${s.displayName} (${s.slug}) flair=${s.flairType?.label ?? "none"}`);
    }
    process.exit(1);
  }

  const shop = shops[0]!;
  if (!shop.flairPurchasedAt && !shop.flairTypeId) {
    console.log(`Already clear: ${shop.displayName} (${shop.slug})`);
    return;
  }

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: { flairPurchasedAt: null, flairTypeId: null },
    select: { slug: true, displayName: true, flairPurchasedAt: true, flairTypeId: true },
  });

  console.log(`Cleared paid flair for ${updated.displayName} (${updated.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
