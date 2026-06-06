import { randomUUID } from "node:crypto";
import { widthHeightPxFromImageBuffer } from "@/lib/artwork-image-dimensions";
import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";
import type { ListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";
import {
  listingArtworkServerProcessingError,
} from "@/lib/listing-request-submit-errors";
import {
  listingRequestArtworkStoredMaxBytes,
  listingRequestArtworkStoredMaxMb,
  listingRequestArtworkUploadMaxBytes,
  listingArtworkUploadCapError,
} from "@/lib/listing-request-artwork-limits";
import {
  listingArtworkV2SourceCapError,
  listingArtworkV2SourceWithinCap,
} from "@/lib/listing-artwork-v2/limits";
import {
  deleteListingArtworkSource,
  deleteListingArtworkStaging,
  getR2ObjectBuffer,
  isListingArtworkSourceKeyForShop,
  isListingArtworkStagingKeyForShop,
  isListingRequestArtworkKeyForShop,
  loadListingArtworkStagingBuffer,
  putPublicR2Object,
} from "@/lib/r2-upload";
import { cropAndPrepareListingArtworkForStorage } from "@/lib/shop-setup-image";

export type ListingArtworkBakeSuccess = {
  ok: true;
  requestImageKey: string;
  publicUrl: string;
  contentType: string;
  width: number;
  height: number;
};

export type ListingArtworkBakeFailure = {
  ok: false;
  error: string;
  status: 400 | 413 | 500;
};

export type ListingArtworkBakeResult = ListingArtworkBakeSuccess | ListingArtworkBakeFailure;

async function bakeListingArtworkFromBuffer(params: {
  shopId: string;
  sourceBuffer: Buffer;
  cropPayload: ListingArtworkCropPayload;
  printAreaW: number | null;
  printAreaH: number | null;
  letterboxFill: ListingArtworkLetterboxFill | null;
  catalogImageRequirementLabel?: string | null;
  maxDecodePixels?: number;
}): Promise<ListingArtworkBakeResult> {
  const { shopId, sourceBuffer, cropPayload, printAreaW, printAreaH, letterboxFill, maxDecodePixels } =
    params;

  let artwork: Awaited<ReturnType<typeof cropAndPrepareListingArtworkForStorage>>;
  try {
    artwork = await cropAndPrepareListingArtworkForStorage(
      sourceBuffer,
      cropPayload,
      listingRequestArtworkStoredMaxBytes(),
      printAreaW,
      printAreaH,
      letterboxFill,
      maxDecodePixels,
    );
  } catch (e) {
    console.error("[bakeListingArtworkFromBuffer] crop failed", { shopId, e });
    return { ok: false, error: listingArtworkServerProcessingError(listingRequestArtworkStoredMaxMb()), status: 500 };
  }

  if (!artwork) {
    return {
      ok: false,
      error: listingArtworkServerProcessingError(listingRequestArtworkStoredMaxMb()),
      status: 500,
    };
  }

  if (printAreaW != null && printAreaH != null) {
    const outDims = await widthHeightPxFromImageBuffer(artwork.body);
    if (!outDims || !exportedImageMeetsPrintDimensions(outDims.w, outDims.h, printAreaW, printAreaH)) {
      return {
        ok: false,
        error: params.catalogImageRequirementLabel
          ? `Artwork must match the exact print pixel size for this item (${params.catalogImageRequirementLabel}). Try cropping again.`
          : "Artwork must match the exact print pixel size for this item. Try cropping again.",
        status: 400,
      };
    }
  }

  const outDims = await widthHeightPxFromImageBuffer(artwork.body);
  const requestImageKey = `shops/${shopId}/listing-request/${randomUUID()}.${artwork.fileExtension}`;
  let publicUrl: string;
  try {
    publicUrl = await putPublicR2Object({
      key: requestImageKey,
      body: artwork.body,
      contentType: artwork.contentType,
    });
  } catch (e) {
    console.error("[bakeListingArtworkFromBuffer] R2 put failed", { shopId, requestImageKey, e });
    return { ok: false, error: listingArtworkServerProcessingError(listingRequestArtworkStoredMaxMb()), status: 500 };
  }

  return {
    ok: true,
    requestImageKey,
    publicUrl,
    contentType: artwork.contentType,
    width: outDims?.w ?? cropPayload.printWidthPx,
    height: outDims?.h ?? cropPayload.printHeightPx,
  };
}

/**
 * v2: crop presigned source artwork and write the final print file to `listing-request/`.
 */
export async function bakeListingArtworkFromSource(params: {
  shopId: string;
  sourceKey: string;
  cropPayload: ListingArtworkCropPayload;
  printAreaW: number | null;
  printAreaH: number | null;
  letterboxFill: ListingArtworkLetterboxFill | null;
  catalogImageRequirementLabel?: string | null;
  maxDecodePixels?: number;
  maxSourceBytes?: number;
}): Promise<ListingArtworkBakeResult> {
  const { shopId, sourceKey } = params;

  if (!isListingArtworkSourceKeyForShop(sourceKey, shopId)) {
    return { ok: false, error: "Invalid artwork upload reference. Try uploading again.", status: 400 };
  }

  const source = await getR2ObjectBuffer(sourceKey);
  if (!source || source.length === 0) {
    return {
      ok: false,
      error: "Uploaded artwork was not found. Try uploading again.",
      status: 400,
    };
  }
  const maxSourceBytes = params.maxSourceBytes;
  if (maxSourceBytes != null && !listingArtworkV2SourceWithinCap(source.length, maxSourceBytes)) {
    return { ok: false, error: listingArtworkV2SourceCapError(maxSourceBytes), status: 413 };
  }
  if (maxSourceBytes == null && !listingArtworkV2SourceWithinCap(source.length)) {
    return { ok: false, error: listingArtworkV2SourceCapError(), status: 413 };
  }

  const result = await bakeListingArtworkFromBuffer({
    shopId,
    sourceBuffer: source,
    cropPayload: params.cropPayload,
    printAreaW: params.printAreaW,
    printAreaH: params.printAreaH,
    letterboxFill: params.letterboxFill,
    catalogImageRequirementLabel: params.catalogImageRequirementLabel,
    maxDecodePixels: params.maxDecodePixels,
  });

  if (result.ok) {
    try {
      await deleteListingArtworkSource(sourceKey);
    } catch (e) {
      console.warn("[bakeListingArtworkFromSource] source cleanup failed", { shopId, sourceKey, e });
    }
  }

  return result;
}

/**
 * v1: crop staged source artwork and write the final print file to `listing-request/`.
 */
export async function bakeListingArtworkFromStaging(params: {
  shopId: string;
  stagingKey: string;
  cropPayload: ListingArtworkCropPayload;
  printAreaW: number | null;
  printAreaH: number | null;
  letterboxFill: ListingArtworkLetterboxFill | null;
  catalogImageRequirementLabel?: string | null;
  maxDecodePixels?: number;
}): Promise<ListingArtworkBakeResult> {
  const { shopId, stagingKey, cropPayload, printAreaW, printAreaH, letterboxFill } = params;
  const uploadMax = listingRequestArtworkUploadMaxBytes();

  if (!isListingArtworkStagingKeyForShop(stagingKey, shopId)) {
    return { ok: false, error: "Invalid artwork upload reference. Try uploading again.", status: 400 };
  }

  const staged = await loadListingArtworkStagingBuffer(stagingKey);
  if (!staged || staged.length === 0) {
    return {
      ok: false,
      error: "Uploaded artwork was not found. Try uploading again.",
      status: 400,
    };
  }
  if (staged.length > uploadMax) {
    return { ok: false, error: listingArtworkUploadCapError(), status: 413 };
  }

  const result = await bakeListingArtworkFromBuffer({
    shopId,
    sourceBuffer: staged,
    cropPayload,
    printAreaW,
    printAreaH,
    letterboxFill,
    catalogImageRequirementLabel: params.catalogImageRequirementLabel,
    maxDecodePixels: params.maxDecodePixels,
  });

  if (!result.ok) return result;

  try {
    await deleteListingArtworkStaging(stagingKey);
  } catch (e) {
    console.warn("[bakeListingArtworkFromStaging] staging cleanup failed", { shopId, stagingKey, e });
  }

  return result;
}

/** Validate a pre-baked listing-request object key before submit references it. */
export function validateListingArtworkBakedKeyForShop(
  key: string,
  shopId: string,
): key is string {
  return isListingRequestArtworkKeyForShop(key, shopId);
}
