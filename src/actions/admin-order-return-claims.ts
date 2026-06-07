"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  OrderReturnClaimStatus,
  type OrderReturnClaimRejectionReason,
} from "@/generated/prisma/enums";
import { deleteOrderReturnClaimImagesFromR2 } from "@/lib/order-return-claim-r2";
import { parseOrderReturnClaimRejectionReason } from "@/lib/order-return-claim-rejection-reasons";
import { prisma, prismaOrderReturnClaimOrNull } from "@/lib/prisma";
import {
  sendOrderReturnClaimAcceptedEmail,
  sendOrderReturnClaimRejectedEmail,
} from "@/lib/send-order-return-claim-decision-email";
import { getAdminSessionReadonly } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

const VALID_STATUSES = new Set<string>([
  OrderReturnClaimStatus.new,
  OrderReturnClaimStatus.accepted_wip,
  OrderReturnClaimStatus.accepted_complete,
  OrderReturnClaimStatus.rejected,
]);

export type AdminUpdateOrderReturnClaimStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function adminUpdateOrderReturnClaimStatus(
  formData: FormData,
): Promise<AdminUpdateOrderReturnClaimStatusResult> {
  await requireAdmin();
  const claimId = String(formData.get("claimId") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!claimId || !VALID_STATUSES.has(statusRaw)) {
    return { ok: false, error: "Invalid status." };
  }

  const newStatus = statusRaw as OrderReturnClaimStatus;
  const rejectionReasonRaw = String(formData.get("rejectionReason") ?? "").trim();
  const rejectionReason = parseOrderReturnClaimRejectionReason(rejectionReasonRaw);

  if (newStatus === OrderReturnClaimStatus.rejected && !rejectionReason) {
    return { ok: false, error: "Select a rejection reason." };
  }

  const patchNotes = formData.has("adminNotes");
  const adminNotesRaw = String(formData.get("adminNotes") ?? "");
  const adminNotes = adminNotesRaw.trim() ? adminNotesRaw : null;

  const claimDelegate = prismaOrderReturnClaimOrNull();
  const imageDelegate = (
    prisma as { orderReturnClaimImage?: { deleteMany: (args: unknown) => Promise<unknown> } }
  ).orderReturnClaimImage;
  if (!claimDelegate || typeof imageDelegate?.deleteMany !== "function") {
    return { ok: false, error: "Returns tracker is unavailable on this server." };
  }

  const before = await claimDelegate.findUnique({
    where: { id: claimId },
    select: {
      status: true,
      email: true,
      orderNumber: true,
      rejectionReason: true,
      rejectionEmailSentAt: true,
      acceptedEmailSentAt: true,
      images: { select: { id: true, imageR2Key: true } },
    },
  });
  if (!before) return { ok: false, error: "Claim not found." };

  const transitioningToRejected =
    newStatus === OrderReturnClaimStatus.rejected &&
    before.status !== OrderReturnClaimStatus.rejected;
  const transitioningToAccepted =
    newStatus === OrderReturnClaimStatus.accepted_complete &&
    before.status !== OrderReturnClaimStatus.accepted_complete;

  if (transitioningToRejected && rejectionReason) {
    const emailResult = await sendOrderReturnClaimRejectedEmail({
      toEmail: before.email,
      orderNumber: before.orderNumber,
      claimId,
      rejectionReason,
    });
    if (!emailResult.ok) {
      console.error(
        `[order-return-claim] rejection email failed for ${claimId}: ${emailResult.error}`,
      );
      return { ok: false, error: emailResult.error };
    }
  }

  if (transitioningToAccepted) {
    const emailResult = await sendOrderReturnClaimAcceptedEmail({
      toEmail: before.email,
      orderNumber: before.orderNumber,
      claimId,
    });
    if (!emailResult.ok) {
      console.error(
        `[order-return-claim] accepted email failed for ${claimId}: ${emailResult.error}`,
      );
      return { ok: false, error: emailResult.error };
    }
  }

  const now = new Date();
  await claimDelegate.update({
    where: { id: claimId },
    data: {
      status: newStatus,
      rejectionReason:
        newStatus === OrderReturnClaimStatus.rejected ? rejectionReason : null,
      ...(transitioningToRejected ? { rejectionEmailSentAt: now } : {}),
      ...(transitioningToAccepted ? { acceptedEmailSentAt: now } : {}),
      ...(patchNotes ? { adminNotes } : {}),
    },
  });

  const shouldDeletePhotos =
    newStatus === OrderReturnClaimStatus.accepted_complete &&
    before.status !== OrderReturnClaimStatus.accepted_complete &&
    before.images.length > 0;

  if (shouldDeletePhotos) {
    const keys = before.images.map((img) => img.imageR2Key);
    await deleteOrderReturnClaimImagesFromR2(claimId, keys);
    await imageDelegate.deleteMany({ where: { claimId } });
  }

  revalidatePath("/admin");
  return { ok: true };
}

export type AdminSaveOrderReturnClaimNotesResult =
  | { ok: true }
  | { ok: false; error: string };

/** Notes-only update (no status change, no revalidate — avoids resetting the table while typing). */
export async function adminSaveOrderReturnClaimNotes(
  claimId: string,
  adminNotesRaw: string,
): Promise<AdminSaveOrderReturnClaimNotesResult> {
  await requireAdmin();
  const id = claimId.trim();
  if (!id) return { ok: false, error: "Missing claim." };

  const claimDelegate = prismaOrderReturnClaimOrNull();
  if (!claimDelegate) {
    return { ok: false, error: "Returns tracker is unavailable on this server." };
  }

  const adminNotes = adminNotesRaw.trim() ? adminNotesRaw : null;

  try {
    await claimDelegate.update({
      where: { id },
      data: { adminNotes },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save notes." };
  }
}
