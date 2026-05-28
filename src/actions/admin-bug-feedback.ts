"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ShopUserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { sendBugFeedbackResolvedThankYouEmail } from "@/lib/send-shop-account-change-notification-email";
import { getAdminSessionReadonly } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminUpdateBugFeedbackReport(formData: FormData): Promise<void> {
  await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "").trim();
  if (!reportId) return;

  const resolvedRaw = String(formData.get("resolved") ?? "").trim();
  const resolved =
    resolvedRaw === "1" ? true : resolvedRaw === "0" ? false : undefined;
  const patchAdminNotes = formData.has("adminNotes");
  const adminNotesRaw = String(formData.get("adminNotes") ?? "");
  const adminNotes = adminNotesRaw.trim() ? adminNotesRaw : null;

  const before = await prisma.bugFeedbackReport.findUnique({
    where: { id: reportId },
    select: {
      resolvedAt: true,
      shopId: true,
      shop: { select: { displayName: true } },
    },
  });
  if (!before) return;

  await prisma.bugFeedbackReport.update({
    where: { id: reportId },
    data: {
      ...(resolved === true ? { resolvedAt: new Date() } : {}),
      ...(resolved === false ? { resolvedAt: null } : {}),
      ...(patchAdminNotes ? { adminNotes } : {}),
    },
  });

  if (resolved === true && before.resolvedAt == null) {
    const owner = await prisma.shopUser.findFirst({
      where: { shopId: before.shopId, role: ShopUserRole.owner },
      select: { email: true },
    });
    if (owner?.email) {
      const r = await sendBugFeedbackResolvedThankYouEmail({
        toEmail: owner.email,
        shopDisplayName: before.shop.displayName?.trim() ?? "",
      });
      if (!r.ok) {
        console.error("[adminUpdateBugFeedbackReport] thank-you email:", r.error);
      }
    }
  }

  revalidatePath("/admin");
}

