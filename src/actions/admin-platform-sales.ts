"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";

const CONFIRM_PHRASE = "DELETE SALES";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/**
 * Deletes all buyer orders and platform checkout rows that feed the admin Platform sales tab
 * (shop creation, listings, promotions, support tips, merchandise). Resets shop merchandise
 * sales counters. Blocked in production unless `ALLOW_ADMIN_CLEAR_SALES_HISTORY=true`.
 */
export async function adminClearPlatformSalesHistoryAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_ADMIN_CLEAR_SALES_HISTORY?.trim() !== "true"
  ) {
    return {
      ok: false,
      error:
        "Clearing sales history is disabled in production. Set ALLOW_ADMIN_CLEAR_SALES_HISTORY=true to allow.",
    };
  }

  const confirm = String(formData.get("confirmPhrase") ?? "").trim();
  if (confirm !== CONFIRM_PHRASE) {
    return { ok: false, error: `Type ${CONFIRM_PHRASE} exactly to confirm.` };
  }

  await prisma.$transaction(async (tx) => {
    // Buyer merchandise (cascades order lines, fulfillment jobs, return claims).
    await tx.order.deleteMany({});

    // Platform checkout history (Shop sales - Profit / Platform sales - Profit breakdowns).
    await tx.supportTip.deleteMany({});
    await tx.promotionPurchase.deleteMany({});
    await tx.listingCreditPackPurchase.deleteMany({});
    await tx.shopFlairPurchase.deleteMany({});
    await tx.shopGoogleShoppingPurchase.deleteMany({});
    await tx.shopReactivationPurchase.deleteMany({});
    await tx.creatorGiftPurchase.deleteMany({});
    await tx.shopSetupFeePurchase.deleteMany({});

    await tx.shop.updateMany({ data: { totalSalesCents: 0 } });
    await tx.shopSalesDashboardSnapshot.deleteMany({});
  });

  revalidateAdminViews();
  revalidatePath("/admin");
  return { ok: true };
}
