"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ADMIN_ANNOUNCEMENT_KIND,
  chunkRows,
  validateAdminAnnouncementBody,
} from "@/lib/admin-announcements";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";

export type AdminSendShopAnnouncementResult =
  | { ok: true; sentCount: number }
  | { ok: false; error: string };

const CREATE_MANY_CHUNK_SIZE = 500;

export async function adminSendShopAnnouncement(
  _prev: AdminSendShopAnnouncementResult | undefined,
  formData: FormData,
): Promise<AdminSendShopAnnouncementResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const parsed = validateAdminAnnouncementBody(String(formData.get("body") ?? ""));
  if (!parsed.ok) return parsed;

  const shops = await prisma.shop.findMany({
    where: {
      active: true,
      slug: { not: PLATFORM_SHOP_SLUG },
      ownerPausedShopAt: null,
      accountDeletionRequestedAt: null,
      users: { some: {} },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (shops.length === 0) {
    return { ok: false, error: "No active creator shops found." };
  }

  let sentCount = 0;
  const now = new Date();
  for (const chunk of chunkRows(shops, CREATE_MANY_CHUNK_SIZE)) {
    const created = await prisma.shopOwnerNotice.createMany({
      data: chunk.map((shop) => ({
        shopId: shop.id,
        kind: ADMIN_ANNOUNCEMENT_KIND,
        body: parsed.body,
        createdAt: now,
      })),
    });
    sentCount += created.count;
  }

  revalidateAdminViews();
  revalidatePath("/dashboard");
  return { ok: true, sentCount };
}
