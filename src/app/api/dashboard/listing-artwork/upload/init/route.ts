import { NextResponse } from "next/server";
import {
  createPresignedR2PutUrl,
  isR2UploadConfigured,
  shopListingArtworkSourceObjectKey,
  verifyListingArtworkStagingR2Write,
} from "@/lib/r2-upload";
import {
  listingArtworkV2SourceCapError,
  listingArtworkV2SourceWithinCap,
} from "@/lib/listing-artwork-v2/limits";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";

export const runtime = "nodejs";

const PRESIGNED_TTL_SECONDS = 900;

function listingArtworkExtensionForContentType(contentType: string): string | null {
  const ct = contentType.toLowerCase().split(";")[0].trim();
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpeg";
  if (ct === "image/webp") return "webp";
  return null;
}

type InitBody = {
  contentType?: string;
  byteSize?: number;
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

  let body: InitBody;
  try {
    body = (await request.json()) as InitBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const contentType = String(body.contentType ?? "").trim();
  const byteSize = Number(body.byteSize);
  const ext = listingArtworkExtensionForContentType(contentType);

  if (!ext) {
    return NextResponse.json({ error: "Use a PNG, JPEG, or WebP artwork file." }, { status: 400 });
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return NextResponse.json({ error: "Choose an artwork file to upload." }, { status: 400 });
  }
  if (!listingArtworkV2SourceWithinCap(byteSize)) {
    return NextResponse.json({ error: listingArtworkV2SourceCapError() }, { status: 413 });
  }

  const writeCheck = await verifyListingArtworkStagingR2Write(resolved.shop.shopId);
  if (!writeCheck.ok) {
    return NextResponse.json({ error: writeCheck.error }, { status: 503 });
  }

  const sourceKey = shopListingArtworkSourceObjectKey(resolved.shop.shopId, ext);
  let presignedPutUrl: string;
  try {
    presignedPutUrl = await createPresignedR2PutUrl({
      key: sourceKey,
      contentType,
      expiresInSeconds: PRESIGNED_TTL_SECONDS,
    });
  } catch (e) {
    console.error("[listing-artwork/upload/init]", e);
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + PRESIGNED_TTL_SECONDS * 1000).toISOString();

  return NextResponse.json({
    ok: true,
    sourceKey,
    presignedPutUrl,
    expiresAt,
  });
}
