/**
 * Verify chunked listing-artwork staging write + reassemble on R2.
 *
 * Usage: npx tsx scripts/verify-listing-artwork-staging.ts
 * Prod:  node scripts/with-production-env.cjs node_modules/tsx/dist/cli.mjs scripts/verify-listing-artwork-staging.ts
 */
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import {
  deleteListingArtworkStaging,
  isR2UploadConfigured,
  loadListingArtworkStagingBuffer,
  putListingArtworkStagingPart,
  shopListingArtworkStagingObjectKey,
} from "../src/lib/r2-upload";
import { listingArtworkStagingChunkCount } from "../src/lib/listing-artwork-staging-chunks";
import { LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES } from "../src/lib/listing-request-artwork-limits";

async function main() {
  if (!isR2UploadConfigured()) {
    console.error("R2 not configured — set R2_* env vars first.");
    process.exit(1);
  }

  const shop = await prisma.shop.findFirst({
    where: { slug: { not: "stillwet" } },
    select: { id: true, slug: true },
  });
  if (!shop) {
    console.error("No shop found for staging test.");
    process.exit(1);
  }

  const png = await sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();

  const stagingKey = shopListingArtworkStagingObjectKey(shop.id, "png");
  const chunkSize = LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES;
  const partCount = listingArtworkStagingChunkCount(png.length);

  console.log(`Shop: ${shop.slug}, staging key: ${stagingKey}`);
  console.log(`PNG ${png.length} bytes → ${partCount} chunk(s)`);

  for (let i = 0; i < partCount; i++) {
    const start = i * chunkSize;
    const part = png.subarray(start, Math.min(png.length, start + chunkSize));
    const put = await putListingArtworkStagingPart(stagingKey, i, Buffer.from(part));
    if (!put.ok) {
      console.error(`FAILED: could not write part ${i}: ${put.error}`);
      process.exit(1);
    }
  }

  const loaded = await loadListingArtworkStagingBuffer(stagingKey);
  if (!loaded || loaded.length !== png.length) {
    console.error("FAILED: reassembled buffer missing or wrong size", loaded?.length);
    process.exit(1);
  }
  if (!loaded.equals(png)) {
    console.error("FAILED: reassembled bytes do not match source");
    process.exit(1);
  }

  await deleteListingArtworkStaging(stagingKey);
  console.log("OK: chunked staging write + reassemble + cleanup succeeded.");
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
