import { NextResponse } from "next/server";
import { FulfillmentType } from "@/generated/prisma/enums";
import { loadAdminCatalogItemArtworkPolicy } from "@/lib/admin-baseline-catalog-rows";
import {
  bakeListingArtworkFromSource,
  bakeListingArtworkFromStaging,
} from "@/lib/listing-artwork-bake.server";
import { parseListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import {
  listingArtworkTransformV2ToCropPayload,
  parseListingArtworkTransformV2,
} from "@/lib/listing-artwork-v2/transform";
import { resolveListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";
import { resolveDashboardTabApiShop } from "@/lib/dashboard-tab-api-session";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import { prisma } from "@/lib/prisma";

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

async function resolveArtworkPolicyForProduct(productIdRaw: string) {
  const pickRaw = productIdRaw.trim();
  const baselinePick = parseBaselinePick(pickRaw);

  let printAreaW: number | null = null;
  let printAreaH: number | null = null;
  let catalogImageRequirementLabel: string | null = null;
  let letterboxFill = null as ReturnType<typeof resolveListingArtworkLetterboxFill> | null;

  if (baselinePick) {
    const adminItem = await loadAdminCatalogItemArtworkPolicy(baselinePick.itemId);
    catalogImageRequirementLabel = adminItem?.itemImageRequirementLabel?.trim() || null;
    const pw = adminItem?.itemPrintAreaWidthPx ?? null;
    const ph = adminItem?.itemPrintAreaHeightPx ?? null;
    if (pw != null && ph != null && pw > 0 && ph > 0) {
      printAreaW = pw;
      printAreaH = ph;
    }
    if (adminItem) {
      letterboxFill = resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: adminItem.itemArtworkLetterboxFill,
        itemLargeListingArtwork: adminItem.itemLargeListingArtwork,
        catalogItemName: adminItem.name,
        printAreaWidthPx: printAreaW,
        printAreaHeightPx: printAreaH,
      });
    }
    return { printAreaW, printAreaH, catalogImageRequirementLabel, letterboxFill };
  }

  const product = await prisma.product.findFirst({
    where: {
      id: pickRaw,
      active: true,
      fulfillmentType: FulfillmentType.printify,
    },
    select: { id: true },
  });
  if (!product) return null;

  return { printAreaW, printAreaH, catalogImageRequirementLabel, letterboxFill };
}

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

  const policy = await resolveArtworkPolicyForProduct(productId);
  if (!policy) {
    return NextResponse.json({ error: "That catalog item is not available." }, { status: 400 });
  }

  const letterboxFill = transformV2?.letterboxFill ?? policy.letterboxFill;

  const result = sourceKey
    ? await bakeListingArtworkFromSource({
        shopId: resolved.shop.shopId,
        sourceKey,
        cropPayload,
        printAreaW: policy.printAreaW,
        printAreaH: policy.printAreaH,
        letterboxFill,
        catalogImageRequirementLabel: policy.catalogImageRequirementLabel,
      })
    : await bakeListingArtworkFromStaging({
        shopId: resolved.shop.shopId,
        stagingKey,
        cropPayload,
        printAreaW: policy.printAreaW,
        printAreaH: policy.printAreaH,
        letterboxFill,
        catalogImageRequirementLabel: policy.catalogImageRequirementLabel,
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
