import { NextResponse } from "next/server";
import {
  isListingArtworkSourceKeyForShop,
  isR2UploadConfigured,
  openR2ObjectStream,
} from "@/lib/r2-upload";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";

export const runtime = "nodejs";

/** Same-origin artwork source for compose UI (streams from R2; avoids presigned GET CORS). */
export async function GET(request: Request) {
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

  const sourceKey = String(new URL(request.url).searchParams.get("sourceKey") ?? "").trim();
  if (!sourceKey || !isListingArtworkSourceKeyForShop(sourceKey, resolved.shop.shopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const opened = await openR2ObjectStream(sourceKey);
  if (!opened) {
    return NextResponse.json({ error: "Upload was not found." }, { status: 404 });
  }

  return new NextResponse(opened.body, {
    headers: {
      "Content-Type": opened.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
