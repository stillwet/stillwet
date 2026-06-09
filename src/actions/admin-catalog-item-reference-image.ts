"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { revalidatePublicStorefront } from "@/lib/revalidate-public-storefront";
import {
  adminCatalogItemSizeExampleImageObjectKey,
  catalogItemSizeExampleImageUrlToObjectKey,
  deleteAdminCatalogItemSizeExampleObject,
  isR2UploadConfigured,
  putPublicR2Object,
} from "@/lib/r2-upload";
import { compressShopListingSupplementPhotoWebp } from "@/lib/shop-setup-image";
import { fetchPublicHttpsImage, parseSafePublicHttpsImageUrl } from "@/lib/fetch-public-https-image";

export type AdminCatalogSizeExampleImageFormState = {
  ok: boolean;
  error: string | null;
  url?: string | null;
};

const initialState: AdminCatalogSizeExampleImageFormState = {
  ok: false,
  error: null,
};

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/**
 * Upload or import a catalog-item size example photo (~100 KiB WebP on R2).
 * Saved to `AdminCatalogItem.itemSizeExampleImageUrl`.
 */
export async function adminUpsertCatalogItemSizeExampleImageForm(
  _prev: AdminCatalogSizeExampleImageFormState,
  formData: FormData,
): Promise<AdminCatalogSizeExampleImageFormState> {
  await requireAdmin();
  const catalogItemId = String(formData.get("catalogItemId") ?? "").trim();
  if (!catalogItemId) {
    return { ok: false, error: "Missing catalog item." };
  }

  const item = await prisma.adminCatalogItem.findUnique({
    where: { id: catalogItemId },
    select: { id: true },
  });
  if (!item) {
    return { ok: false, error: "Catalog item not found." };
  }

  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error: "Image uploads are not configured (R2 env vars missing on the server).",
    };
  }

  const fileRaw = formData.get("catalogItemSizeExampleImageFile");
  const urlRaw = String(formData.get("catalogItemSizeExampleImageUrl") ?? "").trim();

  let buf: Buffer | null = null;
  if (fileRaw instanceof Blob && fileRaw.size > 0) {
    if (fileRaw.size > 20 * 1024 * 1024) {
      return { ok: false, error: "File is too large before processing (max 20 MB)." };
    }
    buf = Buffer.from(await fileRaw.arrayBuffer());
  } else if (urlRaw) {
    const u = parseSafePublicHttpsImageUrl(urlRaw);
    if (!u) {
      return {
        ok: false,
        error: "Use a public https:// image URL (private networks and non-HTTPS links are blocked).",
      };
    }
    buf = await fetchPublicHttpsImage(u);
  } else {
    return { ok: false, error: "Choose an image file or paste an HTTPS image URL." };
  }

  if (!buf) {
    return {
      ok: false,
      error: "Could not load that image from the URL. Check the link or try a file upload instead.",
    };
  }

  const webp = await compressShopListingSupplementPhotoWebp(buf);
  if (!webp) {
    return {
      ok: false,
      error: "Could not compress to under 100 KiB. Try a smaller or simpler image.",
    };
  }

  try {
    const key = adminCatalogItemSizeExampleImageObjectKey(catalogItemId);
    const publicUrl = await putPublicR2Object({
      key,
      body: webp,
      contentType: "image/webp",
    });
    if (!catalogItemSizeExampleImageUrlToObjectKey(publicUrl, catalogItemId)) {
      return { ok: false, error: "Upload succeeded but URL validation failed. Try again or contact support." };
    }

    await prisma.adminCatalogItem.update({
      where: { id: catalogItemId },
      data: { itemSizeExampleImageUrl: publicUrl },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Upload failed: ${msg}` };
  }

  revalidateAdminViews();
  revalidatePublicStorefront();

  const saved = await prisma.adminCatalogItem.findUnique({
    where: { id: catalogItemId },
    select: { itemSizeExampleImageUrl: true },
  });

  return { ok: true, error: null, url: saved?.itemSizeExampleImageUrl ?? null };
}

export async function adminClearCatalogItemSizeExampleImage(formData: FormData): Promise<void> {
  await requireAdmin();
  const catalogItemId = String(formData.get("catalogItemId") ?? "").trim();
  if (!catalogItemId) return;

  const item = await prisma.adminCatalogItem.findUnique({
    where: { id: catalogItemId },
    select: { id: true, itemSizeExampleImageUrl: true },
  });
  if (!item) return;

  if (
    item.itemSizeExampleImageUrl?.trim() &&
    catalogItemSizeExampleImageUrlToObjectKey(item.itemSizeExampleImageUrl.trim(), catalogItemId)
  ) {
    await deleteAdminCatalogItemSizeExampleObject(catalogItemId);
  }

  await prisma.adminCatalogItem.update({
    where: { id: catalogItemId },
    data: { itemSizeExampleImageUrl: null },
  });

  revalidateAdminViews();
  revalidatePublicStorefront();
}

/** @deprecated Use {@link adminUpsertCatalogItemSizeExampleImageForm} */
export async function adminUpsertCatalogItemReferenceImageForm(
  _prev: AdminCatalogSizeExampleImageFormState,
  formData: FormData,
): Promise<AdminCatalogSizeExampleImageFormState> {
  return adminUpsertCatalogItemSizeExampleImageForm(_prev, formData);
}

/** @deprecated Use {@link adminClearCatalogItemSizeExampleImage} */
export async function adminClearCatalogItemReferenceImage(formData: FormData): Promise<void> {
  return adminClearCatalogItemSizeExampleImage(formData);
}

export type AdminCatalogReferenceImageFormState = AdminCatalogSizeExampleImageFormState;
