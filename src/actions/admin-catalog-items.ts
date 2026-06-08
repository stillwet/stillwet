"use server";

import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import {
  parseAdminCatalogItemArtworkForm,
  validateItemLevelWhenNoVariants,
} from "@/lib/admin-catalog-item";
import { syncProductTagsFromAdminCatalogItemId } from "@/lib/baseline-listing-product-tags-sync";
import type { ListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";
import type { CatalogArtworkSourceTierOverride } from "@/lib/listing-artwork-source-tier";
import type { CatalogArtworkTemplate } from "@/lib/admin-catalog-artwork-template";
import type { CatalogCanvasPresentation } from "@/lib/admin-catalog-canvas-presentation";
import {
  catalogArtworkTemplateToDbJsonFromPresets,
  catalogCanvasPresentationFromPreset,
  catalogCanvasPresentationToDbJson,
  parseAdminCatalogArtworkTemplatePreset,
  parseAdminCatalogCanvasPresentationPreset,
} from "@/lib/admin-catalog-canvas-presentation";

const EMPTY_VARIANTS_JSON = [] as unknown as Prisma.InputJsonValue;

export type AdminCatalogItemSaveResult =
  | { ok: true }
  | { ok: false; error: string };

function catalogItemSaveErrorFromUnknown(e: unknown, logLabel: string): string {
  if (e instanceof Prisma.PrismaClientValidationError) {
    console.error(`[${logLabel}] validation`, e);
    return "Invalid catalog item data. Check the fields and try again.";
  }
  console.error(`[${logLabel}]`, e);
  return "Could not save this catalog item.";
}

/** For `useActionState` — wraps update and returns a serializable result. */
export async function adminUpdateCatalogItemFormAction(
  _prev: AdminCatalogItemSaveResult | null,
  formData: FormData,
): Promise<AdminCatalogItemSaveResult> {
  return adminUpdateCatalogItem(formData);
}

/** For `useActionState` — wraps create and returns a serializable result. */
export async function adminAddCatalogItemFormAction(
  _prev: AdminCatalogItemSaveResult | null,
  formData: FormData,
): Promise<AdminCatalogItemSaveResult> {
  return adminAddCatalogItem(formData);
}

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

function itemLevelFromFormWhenNoVariants(formData: FormData):
  | {
      ok: true;
      itemExampleListingUrl: string | null;
      itemMinPriceCents: number;
      itemGoodsServicesCostCents: number;
      itemImageRequirementLabel: string | null;
      itemPrintAreaWidthPx: number | null;
      itemPrintAreaHeightPx: number | null;
      itemMinArtworkDpi: number | null;
      itemArtworkLetterboxFill: ListingArtworkLetterboxFill;
      itemArtworkSourceTierOverride: CatalogArtworkSourceTierOverride;
      itemCanvasPresentation: CatalogCanvasPresentation | null;
      itemArtworkTemplate: CatalogArtworkTemplate | null;
    }
  | { ok: false; error: string } {
  const itemEx = String(formData.get("itemExampleListingUrl") ?? "");
  const itemPrice = String(formData.get("itemMinPriceDollars") ?? "");
  const itemGs = String(formData.get("itemGoodsServicesCostDollars") ?? "");
  const v = validateItemLevelWhenNoVariants(itemEx, itemPrice, itemGs);
  if (!v.ok) return { ok: false, error: v.error };
  const ar = parseAdminCatalogItemArtworkForm(
    String(formData.get("itemImageRequirementLabel") ?? ""),
    String(formData.get("itemPrintAreaWidthPx") ?? ""),
    String(formData.get("itemPrintAreaHeightPx") ?? ""),
    String(formData.get("itemMinArtworkDpi") ?? ""),
    String(formData.get("itemArtworkLetterboxFill") ?? ""),
    String(formData.get("itemArtworkSourceTierOverride") ?? ""),
  );
  if (!ar.ok) return { ok: false, error: ar.error };
  const canvasPreset = parseAdminCatalogCanvasPresentationPreset(
    String(formData.get("itemCanvasPresentationPreset") ?? ""),
  );
  const templatePreset = parseAdminCatalogArtworkTemplatePreset(
    String(formData.get("itemArtworkTemplatePreset") ?? ""),
  );
  const canvasPresentation = catalogCanvasPresentationFromPreset(canvasPreset);
  return {
    ok: true,
    itemExampleListingUrl: v.exampleListingUrl,
    itemMinPriceCents: v.minPriceCents,
    itemGoodsServicesCostCents: v.itemGoodsServicesCostCents,
    itemImageRequirementLabel: ar.itemImageRequirementLabel,
    itemPrintAreaWidthPx: ar.itemPrintAreaWidthPx,
    itemPrintAreaHeightPx: ar.itemPrintAreaHeightPx,
    itemMinArtworkDpi: ar.itemMinArtworkDpi,
    itemArtworkLetterboxFill: ar.itemArtworkLetterboxFill,
    itemArtworkSourceTierOverride: ar.itemArtworkSourceTierOverride,
    itemCanvasPresentation: catalogCanvasPresentationToDbJson(canvasPresentation),
    itemArtworkTemplate: catalogArtworkTemplateToDbJsonFromPresets({
      templatePreset,
      printAreaWidthPx: ar.itemPrintAreaWidthPx,
      printAreaHeightPx: ar.itemPrintAreaHeightPx,
      canvasPresentation,
    }),
  };
}

export async function adminAddCatalogItem(formData: FormData): Promise<AdminCatalogItemSaveResult> {
  await requireAdmin();
  const name = String(formData.get("itemName") ?? "").trim();
  if (!name) return { ok: false, error: "Enter an item name." };

  const itemLevel = itemLevelFromFormWhenNoVariants(formData);
  if (!itemLevel.ok) return { ok: false, error: itemLevel.error };
  const storefrontDescriptionRaw = String(formData.get("storefrontDescription") ?? "");
  const storefrontDescription = storefrontDescriptionRaw.trim()
    ? storefrontDescriptionRaw.trim().slice(0, 10_000)
    : null;

  const maxSort = await prisma.adminCatalogItem.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  try {
    await prisma.adminCatalogItem.create({
      data: {
        name: name.slice(0, 300),
        sortOrder,
        storefrontDescription,
        variants: EMPTY_VARIANTS_JSON,
        itemExampleListingUrl: itemLevel.itemExampleListingUrl,
        itemMinPriceCents: itemLevel.itemMinPriceCents,
        itemGoodsServicesCostCents: itemLevel.itemGoodsServicesCostCents,
        itemImageRequirementLabel: itemLevel.itemImageRequirementLabel,
        itemMinArtworkLongEdgePx: null,
        itemPrintAreaWidthPx: itemLevel.itemPrintAreaWidthPx,
        itemPrintAreaHeightPx: itemLevel.itemPrintAreaHeightPx,
        itemMinArtworkDpi: itemLevel.itemMinArtworkDpi,
        itemArtworkLetterboxFill: itemLevel.itemArtworkLetterboxFill,
        itemArtworkSourceTierOverride: itemLevel.itemArtworkSourceTierOverride,
        itemCanvasPresentation:
          itemLevel.itemCanvasPresentation === null
            ? Prisma.JsonNull
            : (itemLevel.itemCanvasPresentation as Prisma.InputJsonValue),
        itemArtworkTemplate:
          itemLevel.itemArtworkTemplate === null
            ? Prisma.JsonNull
            : (itemLevel.itemArtworkTemplate as Prisma.InputJsonValue),
      },
    });
  } catch (e) {
    return { ok: false, error: catalogItemSaveErrorFromUnknown(e, "adminAddCatalogItem") };
  }
  revalidateAdminViews();
  return { ok: true };
}

export async function adminUpdateCatalogItem(
  formData: FormData,
): Promise<AdminCatalogItemSaveResult> {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "").trim();
  const name = String(formData.get("itemName") ?? "").trim();
  if (!id || !name) return { ok: false, error: "Missing item id or name." };

  const itemLevel = itemLevelFromFormWhenNoVariants(formData);
  if (!itemLevel.ok) return { ok: false, error: itemLevel.error };
  const storefrontDescriptionRaw = String(formData.get("storefrontDescription") ?? "");
  const storefrontDescription = storefrontDescriptionRaw.trim()
    ? storefrontDescriptionRaw.trim().slice(0, 10_000)
    : null;

  try {
    await prisma.adminCatalogItem.update({
      where: { id },
      data: {
        name: name.slice(0, 300),
        variants: EMPTY_VARIANTS_JSON,
        storefrontDescription,
        itemExampleListingUrl: itemLevel.itemExampleListingUrl,
        itemMinPriceCents: itemLevel.itemMinPriceCents,
        itemGoodsServicesCostCents: itemLevel.itemGoodsServicesCostCents,
        itemImageRequirementLabel: itemLevel.itemImageRequirementLabel,
        itemMinArtworkLongEdgePx: null,
        itemPrintAreaWidthPx: itemLevel.itemPrintAreaWidthPx,
        itemPrintAreaHeightPx: itemLevel.itemPrintAreaHeightPx,
        itemMinArtworkDpi: itemLevel.itemMinArtworkDpi,
        itemArtworkLetterboxFill: itemLevel.itemArtworkLetterboxFill,
        itemArtworkSourceTierOverride: itemLevel.itemArtworkSourceTierOverride,
        itemCanvasPresentation:
          itemLevel.itemCanvasPresentation === null
            ? Prisma.JsonNull
            : (itemLevel.itemCanvasPresentation as Prisma.InputJsonValue),
        itemArtworkTemplate:
          itemLevel.itemArtworkTemplate === null
            ? Prisma.JsonNull
            : (itemLevel.itemArtworkTemplate as Prisma.InputJsonValue),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "That catalog item no longer exists." };
    }
    return { ok: false, error: catalogItemSaveErrorFromUnknown(e, "adminUpdateCatalogItem") };
  }
  revalidateAdminViews();
  return { ok: true };
}

export async function adminDeleteCatalogItem(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("itemId") ?? "").trim();
  if (!id) return;
  await prisma.adminCatalogItem.deleteMany({ where: { id } });
  revalidateAdminViews();
}

export async function adminLinkCatalogItemTag(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const tagId = String(formData.get("tagId") ?? "").trim();
  if (!itemId || !tagId) return;

  const [item, tag] = await Promise.all([
    prisma.adminCatalogItem.findUnique({ where: { id: itemId }, select: { id: true } }),
    prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } }),
  ]);
  if (!item || !tag) return;

  await prisma.adminCatalogItemTag.upsert({
    where: { adminCatalogItemId_tagId: { adminCatalogItemId: itemId, tagId } },
    create: { adminCatalogItemId: itemId, tagId },
    update: {},
  });
  await syncProductTagsFromAdminCatalogItemId(itemId);
  revalidateAdminViews();
}

export async function adminUnlinkCatalogItemTag(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const tagId = String(formData.get("tagId") ?? "").trim();
  if (!itemId || !tagId) return;

  await prisma.adminCatalogItemTag.deleteMany({
    where: { adminCatalogItemId: itemId, tagId },
  });
  await syncProductTagsFromAdminCatalogItemId(itemId);
  revalidateAdminViews();
}
