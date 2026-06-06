import { NextResponse } from "next/server";
import {
  bakeListingArtworkFromSource,
  bakeListingArtworkFromStaging,
} from "@/lib/listing-artwork-bake.server";
import { parseListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import { resolveListingArtworkProductPolicy } from "@/lib/listing-artwork-product-policy";
import {
  listingArtworkTransformV2ToCropPayload,
  parseListingArtworkTransformV2,
} from "@/lib/listing-artwork-v2/transform";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";
import { isR2UploadConfigured } from "@/lib/r2-upload";

export const runtime = "nodejs";
/** Large poster / blanket crops can take tens of seconds on serverless. */
export const maxDuration = 120;

type BakeRequestBody = {
  stagingKey?: string;
  sourceKey?: string;
  crop?: unknown;
  transform?: unknown;
  productId?: string;
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

  let body: BakeRequestBody;
  try {
    body = (await request.json()) as BakeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sourceKey = String(body.sourceKey ?? "").trim();
  const stagingKey = String(body.stagingKey ?? "").trim();
  const productId = String(body.productId ?? "").trim();

  const transformV2 = parseListingArtworkTransformV2(body.transform);
  const cropPayload =
    transformV2 != null
      ? listingArtworkTransformV2ToCropPayload(transformV2)
      : parseListingArtworkCropPayload(body.crop);

  if (!sourceKey && !stagingKey) {
    return NextResponse.json({ error: "Missing artwork reference." }, { status: 400 });
  }
  if (!cropPayload) {
    return NextResponse.json({ error: "Invalid placement data." }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ error: "Missing catalog item." }, { status: 400 });
  }

  const policy = await resolveListingArtworkProductPolicy(productId);
  if (!policy) {
    return NextResponse.json({ error: "That catalog item is not available." }, { status: 400 });
  }

  const letterboxFill = transformV2?.letterboxFill ?? policy.letterboxFill;

  const bakeParams = {
    printAreaW: policy.printAreaW,
    printAreaH: policy.printAreaH,
    letterboxFill,
    catalogImageRequirementLabel: policy.catalogImageRequirementLabel,
    maxDecodePixels: policy.maxDecodePixels,
    maxSourceBytes: policy.maxSourceBytes,
  };

  const result = sourceKey
    ? await bakeListingArtworkFromSource({
        shopId: resolved.shop.shopId,
        sourceKey,
        cropPayload,
        ...bakeParams,
      })
    : await bakeListingArtworkFromStaging({
        shopId: resolved.shop.shopId,
        stagingKey,
        cropPayload,
        ...bakeParams,
      });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    requestImageKey: result.requestImageKey,
    publicUrl: result.publicUrl,
    contentType: result.contentType,
    width: result.width,
    height: result.height,
  });
}
