import { deleteR2ObjectsByKeys, isR2UploadConfigured } from "@/lib/r2-upload";

/** Public R2 object key for one claim photo (`returns/claims/{claimId}/{index}.webp`). */
export function orderReturnClaimImageObjectKey(claimId: string, index: number): string {
  return `returns/claims/${claimId}/${index}.webp`;
}

export function isOrderReturnClaimImageR2KeyForClaim(key: string, claimId: string): boolean {
  const k = key.trim();
  if (!k.startsWith(`returns/claims/${claimId}/`) || k.includes("..")) return false;
  const rest = k.slice(`returns/claims/${claimId}/`.length);
  return /^\d+\.webp$/i.test(rest);
}

/** Best-effort delete of claim evidence photos from R2 (keys must match the claim id). */
export async function deleteOrderReturnClaimImagesFromR2(
  claimId: string,
  imageR2Keys: readonly string[],
): Promise<number> {
  if (!isR2UploadConfigured() || imageR2Keys.length === 0) return 0;
  const keys = imageR2Keys.filter((k) => isOrderReturnClaimImageR2KeyForClaim(k, claimId));
  if (keys.length === 0) return 0;
  return deleteR2ObjectsByKeys(keys);
}
