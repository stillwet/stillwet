import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  createPresignedR2GetUrl,
  getR2ObjectBuffer,
  isListingArtworkSourceKeyForShop,
  isR2UploadConfigured,
} from "@/lib/r2-upload";
import {
  listingArtworkV2DecodeCapError,
  listingArtworkV2DecodePixelsWithinCap,
} from "@/lib/listing-artwork-v2/limits";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";

export const runtime = "nodejs";

type CompleteBody = {
  sourceKey?: string;
};

export async function POST(request: Request) {
  const resolved = await resolveDashboardTabApiShop();
  if (!resolved.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: resolved.status });
  }
  if (resolved.shop.isPlatform) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isR2UploadConfigured()) {
    return NextResponse.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  let body: CompleteBody;
  try {
    body = (await request.json()) as CompleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sourceKey = String(body.sourceKey ?? "").trim();
  if (!sourceKey || !isListingArtworkSourceKeyForShop(sourceKey, resolved.shop.shopId)) {
    return NextResponse.json({ error: "Invalid upload reference." }, { status: 400 });
  }

  const buf = await getR2ObjectBuffer(sourceKey);
  if (!buf || buf.length === 0) {
    return NextResponse.json(
      { error: "Upload was not found. Try uploading again." },
      { status: 400 },
    );
  }

  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(buf, { failOn: "none" }).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return NextResponse.json({ error: "Could not read image dimensions." }, { status: 400 });
  }

  if (!listingArtworkV2DecodePixelsWithinCap(width, height)) {
    return NextResponse.json(
      { error: listingArtworkV2DecodeCapError(width, height) },
      { status: 413 },
    );
  }

  let previewGetUrl: string;
  try {
    previewGetUrl = await createPresignedR2GetUrl({
      key: sourceKey,
      expiresInSeconds: 3600,
    });
  } catch (e) {
    console.error("[listing-artwork/upload/complete] presigned GET", e);
    return NextResponse.json({ error: "Could not prepare preview." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sourceKey,
    previewGetUrl,
    width,
    height,
  });
}
