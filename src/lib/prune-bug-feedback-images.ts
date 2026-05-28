import { prisma } from "@/lib/prisma";
import { deleteR2ObjectsByKeys, isR2UploadConfigured } from "@/lib/r2-upload";

const RETAIN_DAYS = 30;

export type PruneBugFeedbackImagesResult =
  | {
      ok: true;
      candidateCount: number;
      deleted: number;
      dryRun: boolean;
      cutoffIso: string;
    }
  | { ok: false; error: string };

export async function pruneBugFeedbackImages(
  dryRun = false,
): Promise<PruneBugFeedbackImagesResult> {
  if (!isR2UploadConfigured()) {
    return { ok: false, error: "r2_not_configured" };
  }

  const cutoff = new Date(Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.bugFeedbackReport.findMany({
    where: {
      imageR2Key: { not: null },
      imageDeletedAt: null,
      imageUploadedAt: { lt: cutoff },
    },
    select: { id: true, imageR2Key: true },
    take: 500,
  });

  const keys = rows.map((r) => r.imageR2Key).filter((k): k is string => Boolean(k));
  if (keys.length === 0) {
    return {
      ok: true,
      candidateCount: rows.length,
      deleted: 0,
      dryRun,
      cutoffIso: cutoff.toISOString(),
    };
  }

  if (!dryRun) {
    await deleteR2ObjectsByKeys(keys);
    await prisma.bugFeedbackReport.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        imageUrl: null,
        imageR2Key: null,
        imageDeletedAt: new Date(),
      },
    });
  }

  return {
    ok: true,
    candidateCount: rows.length,
    deleted: dryRun ? 0 : keys.length,
    dryRun,
    cutoffIso: cutoff.toISOString(),
  };
}
