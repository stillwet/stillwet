import { NextResponse } from "next/server";
import {
  getR2ObjectWithContentType,
  isR2UploadConfigured,
  listingRequestArtworkUrlToObjectKey,
  shopListingRequestImageUrlStrings,
} from "@/lib/r2-upload";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isR2UploadConfigured()) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const listingId = url.searchParams.get("listingId")?.trim() ?? "";
  const index = Number.parseInt(url.searchParams.get("i") ?? "0", 10);
  if (!listingId || !Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const listing = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: { shopId: true, requestImages: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const imageUrls = shopListingRequestImageUrlStrings(listing.requestImages);
  const publicUrl = imageUrls[index];
  if (!publicUrl) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const key = listingRequestArtworkUrlToObjectKey(publicUrl, listing.shopId);
  if (!key) {
    return NextResponse.json({ error: "Invalid image reference." }, { status: 404 });
  }

  const object = await getR2ObjectWithContentType(key);
  if (!object) {
    return NextResponse.json({ error: "Object not found in storage." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.body), {
    status: 200,
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
