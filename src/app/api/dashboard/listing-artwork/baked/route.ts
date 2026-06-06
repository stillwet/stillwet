import { NextResponse } from "next/server";
import {
  isListingRequestArtworkKeyForShop,
  isR2UploadConfigured,
  openR2ObjectStream,
} from "@/lib/r2-upload";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";

export const runtime = "nodejs";

/** Same-origin baked print file for dashboard preview (streams from R2; avoids public URL / CORS issues). */
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

  const requestImageKey = String(new URL(request.url).searchParams.get("requestImageKey") ?? "").trim();
  if (!requestImageKey || !isListingRequestArtworkKeyForShop(requestImageKey, resolved.shop.shopId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const opened = await openR2ObjectStream(requestImageKey);
  if (!opened) {
    return NextResponse.json({ error: "Artwork was not found." }, { status: 404 });
  }

  return new NextResponse(opened.body, {
    headers: {
      "Content-Type": opened.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
