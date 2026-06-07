"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { OrderReturnClaimIssueType } from "@/generated/prisma/enums";
import { prisma, prismaOrderReturnClaimOrNull } from "@/lib/prisma";
import { ORDER_RETURN_CLAIM_MAX_PHOTOS } from "@/lib/order-return-claim-limits";
import {
  readIdentityFromFormData,
  validateOrderReturnClaimIdentity,
  type OrderReturnClaimIdentityField,
} from "@/lib/order-return-claim-identity";
import { orderReturnClaimImageObjectKey } from "@/lib/order-return-claim-r2";
import { isR2UploadConfigured, putPublicR2Object } from "@/lib/r2-upload";
import { sendOrderReturnClaimConfirmationEmail } from "@/lib/send-order-return-claim-email";
import { compressShopProfileImageWebp } from "@/lib/shop-setup-image";

export type VerifyOrderReturnClaimDetailsResult =
  | { ok: true; orderNumber: number }
  | { ok: false; error: string; field?: OrderReturnClaimIdentityField; outsideWindow?: boolean };

export type SubmitOrderReturnClaimResult =
  | { ok: true; claimId: string }
  | {
      ok: false;
      error: string;
      outsideWindow?: boolean;
      field?: OrderReturnClaimIdentityField;
      needsVerification?: boolean;
    };

function parseIssueType(raw: string): OrderReturnClaimIssueType | null {
  if (raw === OrderReturnClaimIssueType.misprint) return OrderReturnClaimIssueType.misprint;
  if (raw === OrderReturnClaimIssueType.defective) return OrderReturnClaimIssueType.defective;
  return null;
}

function truthyCheckbox(raw: FormDataEntryValue | null): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

export async function verifyOrderReturnClaimDetails(
  _prev: VerifyOrderReturnClaimDetailsResult | undefined,
  formData: FormData,
): Promise<VerifyOrderReturnClaimDetailsResult> {
  const result = await validateOrderReturnClaimIdentity(readIdentityFromFormData(formData));
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      field: result.field,
      outsideWindow: result.outsideWindow,
    };
  }
  return { ok: true, orderNumber: result.identity.orderNumber };
}

export async function submitOrderReturnClaim(
  _prev: SubmitOrderReturnClaimResult | undefined,
  formData: FormData,
): Promise<SubmitOrderReturnClaimResult> {
  if (!truthyCheckbox(formData.get("orderDetailsVerified"))) {
    return {
      ok: false,
      error: "Verify your order details before submitting the claim.",
      needsVerification: true,
    };
  }

  const identityResult = await validateOrderReturnClaimIdentity(readIdentityFromFormData(formData));
  if (!identityResult.ok) {
    return {
      ok: false,
      error: identityResult.error,
      field: identityResult.field,
      outsideWindow: identityResult.outsideWindow,
      needsVerification: true,
    };
  }

  const { identity } = identityResult;
  const issueTypeRaw = String(formData.get("issueType") ?? "").trim();
  const catalogItemId = String(formData.get("catalogItemId") ?? "").trim();
  const truthAcknowledged = truthyCheckbox(formData.get("truthAcknowledged"));
  const replacementPolicyAck = truthyCheckbox(formData.get("replacementPolicyAck"));

  const issueType = parseIssueType(issueTypeRaw);
  if (!issueType) return { ok: false, error: "Select an issue type." };
  if (!catalogItemId) return { ok: false, error: "Select an item type." };
  if (!truthAcknowledged) return { ok: false, error: "Confirm that your claim information is truthful." };
  if (!replacementPolicyAck) {
    return {
      ok: false,
      error: "Confirm that you understand replacements are offered when approved, not automatic refunds.",
    };
  }

  const catalogItem = await prisma.adminCatalogItem.findUnique({
    where: { id: catalogItemId },
    select: { id: true, name: true },
  });
  if (!catalogItem) return { ok: false, error: "Select a valid item type." };

  const photoFiles: File[] = [];
  for (let i = 0; i < ORDER_RETURN_CLAIM_MAX_PHOTOS; i++) {
    const entry = formData.get(`photo${i}`);
    if (entry instanceof File && entry.size > 0) photoFiles.push(entry);
  }
  if (photoFiles.length === 0) {
    return { ok: false, error: "Upload at least one photo of the item." };
  }
  if (photoFiles.length > ORDER_RETURN_CLAIM_MAX_PHOTOS) {
    return { ok: false, error: `You can upload up to ${ORDER_RETURN_CLAIM_MAX_PHOTOS} photos.` };
  }

  if (!isR2UploadConfigured()) {
    return { ok: false, error: "Photo uploads are not configured on the server." };
  }

  const claimId = randomUUID();
  const uploadedImages: { sortOrder: number; imageUrl: string; imageR2Key: string }[] = [];

  for (let i = 0; i < photoFiles.length; i++) {
    const file = photoFiles[i]!;
    if (file.size > 15 * 1024 * 1024) {
      return { ok: false, error: "One of the photos is too large before processing (max 15 MB)." };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const webp = await compressShopProfileImageWebp(buf);
    if (!webp) {
      return {
        ok: false,
        error: "Could not compress one of the photos. Try a simpler image under 15 MB.",
      };
    }
    const imageR2Key = orderReturnClaimImageObjectKey(claimId, i);
    const imageUrl = await putPublicR2Object({
      key: imageR2Key,
      body: webp,
      contentType: "image/webp",
    });
    uploadedImages.push({ sortOrder: i, imageUrl, imageR2Key });
  }

  const claimDelegate = prismaOrderReturnClaimOrNull();
  if (!claimDelegate) {
    return { ok: false, error: "Return claims are not available on the server yet. Try again after redeploy." };
  }

  await claimDelegate.create({
    data: {
      id: claimId,
      orderId: identity.orderId,
      orderNumber: identity.orderNumber,
      email: identity.email,
      cardLast4: identity.cardLast4,
      nameOnOrder: identity.nameOnOrder,
      issueType,
      adminCatalogItemId: catalogItem.id,
      catalogItemName: catalogItem.name,
      truthAcknowledged: true,
      replacementPolicyAck: true,
      images: {
        create: uploadedImages.map((img) => ({
          id: randomUUID(),
          sortOrder: img.sortOrder,
          imageUrl: img.imageUrl,
          imageR2Key: img.imageR2Key,
        })),
      },
    },
  });

  const emailResult = await sendOrderReturnClaimConfirmationEmail({
    toEmail: identity.email,
    orderNumber: identity.orderNumber,
    claimId,
  });

  if (emailResult.ok) {
    await claimDelegate.update({
      where: { id: claimId },
      data: { confirmationEmailSentAt: new Date() },
    });
  } else {
    console.error("[submitOrderReturnClaim] confirmation email:", emailResult.error);
  }

  revalidatePath("/admin");
  return { ok: true, claimId };
}

export type OrderReturnClaimCatalogOption = { id: string; name: string };

export async function loadOrderReturnClaimCatalogOptions(): Promise<OrderReturnClaimCatalogOption[]> {
  return prisma.adminCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
}
