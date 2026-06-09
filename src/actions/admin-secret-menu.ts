"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";
import { normalizeShopSlugInput } from "@/lib/normalize-shop-slug-input";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  importStandardAdminCatalogItemsToSecretMenu,
  loadAdminCatalogSecretMenuImportOptions,
} from "@/lib/admin-secret-menu-catalog-copy";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";

const SECRET_MENU_TAB = "secret-menu";
const SECRET_MENU_ANCHOR = "#secret-menu-shops";

export type AdminSecretMenuShopRow = {
  slug: string;
  displayName: string;
  grantedAtIso: string;
};

export type AdminShopSlugPick = {
  slug: string;
  displayName: string;
};

function secretMenuRedirectUrl(params: Record<string, string>): string {
  const q = new URLSearchParams({ tab: SECRET_MENU_TAB, ...params });
  return `${ADMIN_BACKEND_BASE_PATH}?${q.toString()}${SECRET_MENU_ANCHOR}`;
}

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

export async function loadAdminSecretMenuShopRows(): Promise<AdminSecretMenuShopRow[]> {
  const rows = await prisma.shop.findMany({
    where: { secretMenuAccessGrantedAt: { not: null } },
    orderBy: [{ secretMenuAccessGrantedAt: "desc" }, { slug: "asc" }],
    select: {
      slug: true,
      displayName: true,
      secretMenuAccessGrantedAt: true,
    },
  });
  return rows.map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    grantedAtIso: r.secretMenuAccessGrantedAt!.toISOString(),
  }));
}

export async function loadAdminShopSlugPickerOptions(): Promise<AdminShopSlugPick[]> {
  const rows = await prisma.shop.findMany({
    where: { slug: { not: PLATFORM_SHOP_SLUG } },
    orderBy: [{ displayName: "asc" }, { slug: "asc" }],
    select: { slug: true, displayName: true },
  });
  return rows.map((r) => ({ slug: r.slug, displayName: r.displayName }));
}

export async function adminGrantShopSecretMenuAccess(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = normalizeShopSlugInput(String(formData.get("shopSlug") ?? ""));
  if (!slug) {
    redirect(secretMenuRedirectUrl({ smErr: "Enter a shop slug." }));
  }
  if (slug === PLATFORM_SHOP_SLUG) {
    redirect(secretMenuRedirectUrl({ smErr: "The platform catalog shop is not eligible." }));
  }

  const shop = await prisma.shop.findUnique({
    where: { slug },
    select: { id: true, secretMenuAccessGrantedAt: true },
  });
  if (!shop) {
    redirect(secretMenuRedirectUrl({ smErr: `No shop found with slug “${slug}”.` }));
  }

  if (!shop.secretMenuAccessGrantedAt) {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { secretMenuAccessGrantedAt: new Date() },
    });
  }

  revalidateAdminViews();
  revalidatePath("/dashboard");
  redirect(secretMenuRedirectUrl({ smGranted: slug }));
}

export async function adminRevokeShopSecretMenuAccess(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = normalizeShopSlugInput(String(formData.get("shopSlug") ?? ""));
  if (!slug) {
    redirect(secretMenuRedirectUrl({ smErr: "Missing shop slug." }));
  }

  await prisma.shop.updateMany({
    where: { slug },
    data: { secretMenuAccessGrantedAt: null },
  });

  revalidateAdminViews();
  revalidatePath("/dashboard");
  redirect(secretMenuRedirectUrl({ smRevoked: slug }));
}

export async function adminImportStandardCatalogItemsToSecretMenu(formData: FormData): Promise<void> {
  await requireAdmin();
  const sourceItemIds = formData
    .getAll("sourceItemId")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const result = await importStandardAdminCatalogItemsToSecretMenu(sourceItemIds);
  if (!result.ok) {
    redirect(secretMenuRedirectUrl({ smErr: result.error }));
  }

  revalidateAdminViews();
  revalidatePath("/dashboard");
  redirect(
    secretMenuRedirectUrl({
      smImported: String(result.copiedCount),
      smImportSkipped: String(result.skippedAlreadyPresentCount),
    }),
  );
}

export async function loadAdminSecretMenuImportOptions() {
  return loadAdminCatalogSecretMenuImportOptions();
}
