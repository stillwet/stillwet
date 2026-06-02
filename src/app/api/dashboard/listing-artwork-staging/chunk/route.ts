import { NextResponse } from "next/server";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES,
  listingRequestArtworkUploadMaxBytes,
} from "@/lib/listing-request-artwork-limits";
import {
  isListingArtworkStagingKeyForShop,
  isR2UploadConfigured,
  putListingArtworkStagingPart,
} from "@/lib/r2-upload";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";

export const runtime = "nodejs";

const MAX_PARTS = Math.ceil(
  listingRequestArtworkUploadMaxBytes() / LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES,
) + 2;

export async function POST(request: Request) {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    select: { shop: { select: { id: true, slug: true } } },
  });
  const shop = row?.shop;
  if (!shop || shop.slug === PLATFORM_SHOP_SLUG) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isR2UploadConfigured()) {
    return NextResponse.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const stagingKey = String(formData.get("stagingKey") ?? "").trim();
  const partIndexRaw = String(formData.get("partIndex") ?? "").trim();
  const partIndex = Number.parseInt(partIndexRaw, 10);
  const chunk = formData.get("chunk");

  if (!stagingKey || !isListingArtworkStagingKeyForShop(stagingKey, shop.id)) {
    return NextResponse.json({ error: "Invalid staging reference." }, { status: 400 });
  }
  if (!Number.isFinite(partIndex) || partIndex < 0 || partIndex >= MAX_PARTS) {
    return NextResponse.json({ error: "Invalid chunk index." }, { status: 400 });
  }
  if (!chunk || !(chunk instanceof Blob) || chunk.size === 0) {
    return NextResponse.json({ error: "Missing chunk data." }, { status: 400 });
  }
  if (chunk.size > LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES + 256 * 1024) {
    return NextResponse.json({ error: "Chunk too large." }, { status: 413 });
  }

  const body = Buffer.from(await chunk.arrayBuffer());
  const put = await putListingArtworkStagingPart(stagingKey, partIndex, body);
  if (!put.ok) {
    console.error("[listing-artwork-staging/chunk] R2 put failed", {
      shopId: shop.id,
      stagingKey,
      partIndex,
      error: put.error,
    });
    const hint =
      process.env.NODE_ENV === "development"
        ? `Could not store upload chunk: ${put.error}`
        : "Could not store upload chunk. Check R2 credentials and Object Write permission, then try again.";
    return NextResponse.json({ error: hint }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
