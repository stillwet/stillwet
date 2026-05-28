"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS } from "@/lib/platform-all-page-featured-constants";
import type { Prisma } from "@/generated/prisma/client";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";
import type { AdminSaveBrowseShopsPageFeaturedState } from "@/actions/admin-browse-shops-page-featured-state";
import { revalidatePublicStorefront } from "@/lib/revalidate-public-storefront";

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function adminSaveBrowseShopsPageFeaturedShopIdsForm(
  _prev: AdminSaveBrowseShopsPageFeaturedState,
  formData: FormData,
): Promise<AdminSaveBrowseShopsPageFeaturedState> {
  await requireAdmin();
  const raw = formData.get("shopIdsJson");
  let parsed: unknown = null;
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Invalid JSON in form." };
    }
  }
  const normalized = parseShopOrderedFeaturedProductIds(parsed as Prisma.JsonValue, {
    max: SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS,
  });

  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { id: true },
  });
  if (!platform) {
    return { ok: false, error: "Platform catalog shop is missing." };
  }
  if (normalized.length > SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS) {
    return { ok: false, error: `At most ${SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS} shops.` };
  }

  if (normalized.length > 0) {
    const rows = await prisma.shop.findMany({
      where: {
        id: { in: normalized },
        active: true,
        slug: { not: PLATFORM_SHOP_SLUG },
      },
      select: { id: true },
    });
    const ok = new Set(rows.map((r) => r.id));
    const missing = normalized.filter((id) => !ok.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Not all IDs are active creator shops: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
      };
    }
  }

  try {
    await prisma.shop.update({
      where: { id: platform.id },
      data: { browseShopsPageFeaturedShopIds: normalized },
    });
  } catch (e) {
    console.error("[adminSaveBrowseShopsPageFeaturedShopIdsForm]", e);
    return { ok: false, error: "Could not save. Try again." };
  }

  revalidatePath("/shops");
  revalidatePublicStorefront();
  return { ok: true, error: null };
}
