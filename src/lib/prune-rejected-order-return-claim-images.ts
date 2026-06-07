import { OrderReturnClaimStatus } from "@/generated/prisma/enums";
import { deleteOrderReturnClaimImagesFromR2 } from "@/lib/order-return-claim-r2";
import { prisma, prismaOrderReturnClaimOrNull } from "@/lib/prisma";
import { isR2UploadConfigured } from "@/lib/r2-upload";

const CLAIMS_PER_ROUND = 100;
const MAX_ROUNDS = 20;

export type PruneRejectedOrderReturnClaimImagesResult =
  | {
      ok: true;
      claimCount: number;
      imageCount: number;
      dryRun: boolean;
    }
  | { ok: false; error: string };

export async function pruneRejectedOrderReturnClaimImages(
  dryRun = false,
): Promise<PruneRejectedOrderReturnClaimImagesResult> {
  if (!isR2UploadConfigured()) {
    return { ok: false, error: "r2_not_configured" };
  }

  const claimDelegate = prismaOrderReturnClaimOrNull();
  const imageDelegate = (
    prisma as { orderReturnClaimImage?: { deleteMany: (args: unknown) => Promise<{ count: number }> } }
  ).orderReturnClaimImage;
  if (!claimDelegate || typeof imageDelegate?.deleteMany !== "function") {
    return { ok: true, claimCount: 0, imageCount: 0, dryRun };
  }

  let claimCount = 0;
  let imageCount = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const claims = await claimDelegate.findMany({
      where: {
        status: OrderReturnClaimStatus.rejected,
        images: { some: {} },
      },
      select: {
        id: true,
        images: { select: { imageR2Key: true } },
      },
      take: CLAIMS_PER_ROUND,
    });

    if (claims.length === 0) break;

    claimCount += claims.length;
    imageCount += claims.reduce((n, c) => n + c.images.length, 0);

    if (dryRun) continue;

    for (const claim of claims) {
      const keys = claim.images.map((img) => img.imageR2Key);
      await deleteOrderReturnClaimImagesFromR2(claim.id, keys);
      await imageDelegate.deleteMany({ where: { claimId: claim.id } });
    }

    if (claims.length < CLAIMS_PER_ROUND) break;
  }

  return { ok: true, claimCount, imageCount, dryRun };
}
