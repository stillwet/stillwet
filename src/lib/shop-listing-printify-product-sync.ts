import { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import { fetchPrintifyProductDetail, isPrintifyConfigured } from "@/lib/printify";
import { pickImageForVariant, type PrintifyCatalogProduct } from "@/lib/printify-catalog";
import { isPrintifyManagedListingImageUrl } from "@/lib/printify-import-image";
import { prisma } from "@/lib/prisma";
import { galleryFromJson } from "@/lib/product-media";

/**
 * Shop listing `Product` rows should not duplicate every Printify mockup in `imageGallery` (that
 * doubles storefront/R2 references). Keep optional manual (non-Printify) gallery URLs only.
 */
function listingStubImageGalleryJson(
  imageGallery: Prisma.JsonValue | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const manual = galleryFromJson(imageGallery).filter(
    (url) => !isPrintifyManagedListingImageUrl(url),
  );
  return manual.length > 0 ? manual : Prisma.JsonNull;
}

function heroFromPrintifyDetail(
  detail: PrintifyCatalogProduct,
  variantId: string | null,
): { hero: string | null; description: string | null } {
  const gallery = [...new Set(detail.images.map((i) => i.src).filter(Boolean))];
  const hero =
    (variantId ? pickImageForVariant(detail.images, variantId) : null) ??
    gallery[0] ??
    null;
  return { hero, description: detail.description };
}

async function fetchPrintifyDetailForListing(printifyProductId: string): Promise<PrintifyCatalogProduct | null> {
  if (!isPrintifyConfigured()) return null;
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) return null;
  return fetchPrintifyProductDetail(shopId, printifyProductId);
}

/**
 * When a shop listing is wired to Printify (`listingPrintifyProductId`), the per-shop `Product` row
 * (often a baseline stub) must match Printify fulfillment semantics and reuse catalog imagery:
 * manual + tracked + qty 0 reads as "Sold out"; missing `imageUrl` shows no card image.
 *
 * Copies description and hero image from another `Product` with the same `printifyProductId`
 * (platform catalog / synced Printify product), preferring the variant row image when
 * `listingPrintifyVariantId` is set.
 *
 * If there is no other `Product` template (common for shop-specific stubs), loads the same data from the
 * Printify API (`PRINTIFY_SHOP_ID` + `PRINTIFY_API_TOKEN`) so mockups match the admin catalog table.
 */
export async function syncListingProductWithPrintifyCatalog(
  productId: string,
  opts: {
    listingPrintifyProductId: string;
    listingPrintifyVariantId: string | null;
  },
): Promise<void> {
  const pid = opts.listingPrintifyProductId.trim();
  if (!pid) return;

  const template = await prisma.product.findFirst({
    where: {
      printifyProductId: pid,
      fulfillmentType: FulfillmentType.printify,
      id: { not: productId },
    },
    orderBy: { updatedAt: "desc" },
  });

  const variantId = opts.listingPrintifyVariantId?.trim() || null;

  const base: Prisma.ProductUpdateInput = {
    fulfillmentType: FulfillmentType.printify,
    printifyProductId: pid,
    printifyVariantId: variantId,
    trackInventory: false,
  };

  if (!template) {
    const detail = await fetchPrintifyDetailForListing(pid);
    if (detail) {
      const { hero, description } = heroFromPrintifyDetail(detail, variantId);
      await prisma.product.update({
        where: { id: productId },
        data: {
          ...base,
          description: description ?? undefined,
          imageUrl: hero,
          imageGallery: Prisma.JsonNull,
        },
      });
      return;
    }
    await prisma.product.update({
      where: { id: productId },
      data: base,
    });
    return;
  }

  let hero = template.imageUrl?.trim() || null;
  let description: string | null | undefined = template.description;
  const imageGallery = listingStubImageGalleryJson(template.imageGallery);

  if (!hero || (variantId && variantId !== template.printifyVariantId?.trim())) {
    const detail = await fetchPrintifyDetailForListing(pid);
    if (detail) {
      const fromApi = heroFromPrintifyDetail(detail, variantId);
      hero = fromApi.hero ?? hero;
      if (fromApi.description && !description?.trim()) {
        description = fromApi.description;
      }
    }
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      ...base,
      description,
      imageUrl: hero,
      imageGallery,
    },
  });
}
