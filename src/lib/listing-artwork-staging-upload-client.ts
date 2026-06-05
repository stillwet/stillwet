import { createListingArtworkStagingUpload } from "@/actions/dashboard-shop-setup";
import { listingArtworkStagingChunkCount } from "@/lib/listing-artwork-staging-chunks";
import { LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES } from "@/lib/listing-request-artwork-limits";

export async function uploadListingArtworkFileToStaging(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<{ ok: true; stagingKey: string } | { ok: false; error: string }> {
  const prep = await createListingArtworkStagingUpload(file.type, file.size);
  if (!prep.ok) return prep;

  const totalParts = listingArtworkStagingChunkCount(file.size);
  onProgress?.(0, totalParts);

  const chunkSize = LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES;
  let partIndex = 0;
  try {
    for (let offset = 0; offset < file.size; offset += chunkSize, partIndex++) {
      const slice = file.slice(offset, offset + chunkSize);
      const chunkFd = new FormData();
      chunkFd.set("stagingKey", prep.stagingKey);
      chunkFd.set("partIndex", String(partIndex));
      chunkFd.set("chunk", slice, `part-${partIndex}`);
      let chunkRes: Response;
      try {
        chunkRes = await fetch("/api/dashboard/listing-artwork-staging/chunk", {
          method: "POST",
          body: chunkFd,
        });
      } catch {
        return {
          ok: false,
          error: "Artwork upload failed (network). Check your connection and try again.",
        };
      }
      if (!chunkRes.ok) {
        let detail = "";
        try {
          const j = (await chunkRes.json()) as { error?: string };
          detail = j.error?.trim() ?? "";
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          error: detail || `Artwork upload failed (${chunkRes.status}). Try again.`,
        };
      }
      onProgress?.(partIndex + 1, totalParts);
    }
  } catch {
    return { ok: false, error: "Artwork upload failed. Try again." };
  }

  return { ok: true, stagingKey: prep.stagingKey };
}
