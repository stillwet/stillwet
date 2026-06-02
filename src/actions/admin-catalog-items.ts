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
import {
  isMissingLargeListingArtworkColumn,
  LARGE_LISTING_ARTWORK_MIGRATION,
} from "@/lib/admin-baseline-catalog-rows";

const EMPTY_VARIANTS_JSON = [] as unknown as Prisma.InputJsonValue;

export type AdminCatalogItemSaveResult =
  | { ok: true }
  | { ok: false; error: string };

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
      itemLargeListingArtwork: boolean;
    }
  | { ok: false } {
  const itemEx = String(formData.get("itemExampleListingUrl") ?? "");
  const itemPrice = String(formData.get("itemMinPriceDollars") ?? "");
  const itemGs = String(formData.get("itemGoodsServicesCostDollars") ?? "");
  const v = validateItemLevelWhenNoVariants(itemEx, itemPrice, itemGs);
  if (!v.ok) return { ok: false };
  const ar = parseAdminCatalogItemArtworkForm(
    String(formData.get("itemImageRequirementLabel") ?? ""),
    String(formData.get("itemPrintAreaWidthPx") ?? ""),
    String(formData.get("itemPrintAreaHeightPx") ?? ""),
    String(formData.get("itemMinArtworkDpi") ?? ""),
  );
  if (!ar.ok) return { ok: false };
  const itemLargeListingArtwork = formData.get("itemLargeListingArtwork") === "1";
  return {
    ok: true,
    itemExampleListingUrl: v.exampleListingUrl,
    itemMinPriceCents: v.minPriceCents,
    itemGoodsServicesCostCents: v.itemGoodsServicesCostCents,
    itemImageRequirementLabel: ar.itemImageRequirementLabel,
    itemPrintAreaWidthPx: ar.itemPrintAreaWidthPx,
    itemPrintAreaHeightPx: ar.itemPrintAreaHeightPx,
    itemMinArtworkDpi: ar.itemMinArtworkDpi,
    itemLargeListingArtwork,
  };
}

export async function adminAddCatalogItem(formData: FormData): Promise<AdminCatalogItemSaveResult> {
  await requireAdmin();
  const name = String(formData.get("itemName") ?? "").trim();
  if (!name) return { ok: false, error: "Enter an item name." };

  const itemLevel = itemLevelFromFormWhenNoVariants(formData);
  if (!itemLevel.ok) return { ok: false, error: "Check item price and artwork fields." };
  const storefrontDescriptionRaw = String(formData.get("storefrontDescription") ?? "");
  const storefrontDescription = storefrontDescriptionRaw.trim()
    ? storefrontDescriptionRaw.trim().slice(0, 10_000)
    : null;

  const maxSort = await prisma.adminCatalogItem.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  const createData = {
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
    itemLargeListingArtwork: itemLevel.itemLargeListingArtwork,
  };

  try {
    await prisma.adminCatalogItem.create({ data: createData });
  } catch (e) {
    if (isMissingLargeListingArtworkColumn(e)) {
      if (itemLevel.itemLargeListingArtwork) {
        const { itemLargeListingArtwork: _omit, ...withoutLarge } = createData;
        try {
          await prisma.adminCatalogItem.create({ data: withoutLarge });
          revalidateAdminViews();
          return {
            ok: false,
            error: `Large artwork uploads need migration ${LARGE_LISTING_ARTWORK_MIGRATION} on this database. Item saved without the 30 MB flag.`,
          };
        } catch (e2) {
          console.error("[adminAddCatalogItem] retry without large artwork", e2);
          return { ok: false, error: "Could not save this catalog item." };
        }
      }
      const { itemLargeListingArtwork: _omit, ...withoutLarge } = createData;
      await prisma.adminCatalogItem.create({ data: withoutLarge });
    } else {
      console.error("[adminAddCatalogItem]", e);
      return { ok: false, error: "Could not save this catalog item." };
    }
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
  if (!itemLevel.ok) return { ok: false, error: "Check item price and artwork fields." };
  const storefrontDescriptionRaw = String(formData.get("storefrontDescription") ?? "");
  const storefrontDescription = storefrontDescriptionRaw.trim()
    ? storefrontDescriptionRaw.trim().slice(0, 10_000)
    : null;

  const updateData = {
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
    itemLargeListingArtwork: itemLevel.itemLargeListingArtwork,
    /** FK scalars are not on `updateMany` mutation input; disconnect clears the link like `itemPlatformProductId: null`. */
    itemPlatformProduct: { disconnect: true },
  };

  try {
    await prisma.adminCatalogItem.update({
      where: { id },
      data: updateData,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "That catalog item no longer exists." };
    }
    if (isMissingLargeListingArtworkColumn(e)) {
      const { itemLargeListingArtwork: _omit, ...withoutLarge } = updateData;
      try {
        await prisma.adminCatalogItem.update({
          where: { id },
          data: withoutLarge,
        });
        revalidateAdminViews();
        if (itemLevel.itemLargeListingArtwork) {
          return {
            ok: false,
            error: `Large artwork uploads need migration ${LARGE_LISTING_ARTWORK_MIGRATION} on production. Other fields were saved; run npm run db:migrate:prod, then check the box again.`,
          };
        }
        return { ok: true };
      } catch (e2) {
        console.error("[adminUpdateCatalogItem] retry without large artwork", e2);
        return { ok: false, error: "Could not save changes to this catalog item." };
      }
    }
    console.error("[adminUpdateCatalogItem]", e);
    return { ok: false, error: "Could not save changes to this catalog item." };
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
