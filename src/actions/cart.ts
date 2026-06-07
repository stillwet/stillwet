"use server";

import { prisma } from "@/lib/prisma";
import { FulfillmentType } from "@/generated/prisma/enums";
import { listingCheckoutPrintifyVariantId } from "@/lib/printify-variants";
import { getCartSession } from "@/lib/session";
import { maxCartLineQty } from "@/lib/cart-limits";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";
import {
  shopStripeConnectReadyForBuyerSales,
} from "@/lib/shop-stripe-connect-gate";

async function resolveActiveListing(
  productOrListingId: string,
  shopSlug?: string | null,
) {
  const listingWhere = {
    ...storefrontShopListingWhere,
    shop: { active: true },
  };

  const byId = await prisma.shopListing.findFirst({
    where: { id: productOrListingId.trim(), ...listingWhere },
    include: {
      product: true,
      shop: {
        select: {
          id: true,
          slug: true,
          stripeConnectAccountId: true,
          connectChargesEnabled: true,
        },
      },
    },
  });
  if (byId) return byId;

  const slug = shopSlug?.trim() || PLATFORM_SHOP_SLUG;
  return prisma.shopListing.findFirst({
    where: {
      productId: productOrListingId,
      shop: { slug, active: true },
      ...storefrontShopListingWhere,
    },
    include: {
      product: true,
      shop: {
        select: {
          id: true,
          slug: true,
          stripeConnectAccountId: true,
          connectChargesEnabled: true,
        },
      },
    },
  });
}

export async function addToCart(
  productOrListingId: string,
  quantity = 1,
  printifyVariantId?: string | null,
  shopSlug?: string | null,
): Promise<{ ok: true } | { ok: false }> {
  const session = await getCartSession();
  const listing = await resolveActiveListing(productOrListingId, shopSlug);
  if (!listing?.product.active) return { ok: false };
  if (!shopStripeConnectReadyForBuyerSales(listing.shop)) return { ok: false };

  const product = listing.product;
  const lineMax = maxCartLineQty(product.fulfillmentType);
  const q = Math.max(1, Math.min(lineMax, quantity));
  let vid: string | undefined;
  if (product.fulfillmentType === FulfillmentType.printify) {
    const requestedVid =
      typeof printifyVariantId === "string" && printifyVariantId.trim()
        ? printifyVariantId.trim()
        : undefined;
    const resolved = listingCheckoutPrintifyVariantId(
      listing,
      product,
      requestedVid ? { quantity: q, printifyVariantId: requestedVid } : undefined,
    );
    if (!resolved) return { ok: false };
    vid = resolved;
  }

  const keys = Object.keys(session.items).filter(
    (k) => (session.items[k]?.quantity ?? 0) > 0,
  );
  if (keys.length > 0 && session.shopId && session.shopId !== listing.shopId) {
    return { ok: false };
  }

  const listingId = listing.id;
  const prev = session.items[listingId];
  const prevQty = prev?.quantity ?? 0;
  const newQty = Math.min(lineMax, prevQty + q);

  session.items[listingId] =
    vid !== undefined
      ? { quantity: newQty, printifyVariantId: vid }
      : { quantity: newQty };
  session.shopId = listing.shopId;

  await session.save();
  return { ok: true };
}

export async function setCartQuantity(listingId: string, quantity: number) {
  const session = await getCartSession();
  if (quantity <= 0) {
    delete session.items[listingId];
    if (Object.keys(session.items).every((k) => (session.items[k]?.quantity ?? 0) <= 0)) {
      session.shopId = null;
    }
  } else {
    const listing = await prisma.shopListing.findUnique({
      where: { id: listingId },
      include: { product: { select: { fulfillmentType: true } } },
    });
    const lineMax = maxCartLineQty(listing?.product.fulfillmentType);
    const prev = session.items[listingId];
    session.items[listingId] = {
      quantity: Math.min(lineMax ?? 99, quantity),
      ...(prev?.printifyVariantId
        ? { printifyVariantId: prev.printifyVariantId }
        : {}),
    };
  }
  await session.save();
}

export async function clearCart() {
  const session = await getCartSession();
  session.items = {};
  session.shopId = null;
  await session.save();
}

export async function updateCartLineFromForm(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "").trim();
  const legacyProductId = String(formData.get("productId") ?? "").trim();
  const id = listingId || legacyProductId;
  const qty = parseInt(String(formData.get("qty") ?? ""), 10);
  if (!id || !Number.isFinite(qty)) return;
  await setCartQuantity(id, qty);
}

export async function removeCartLineFromForm(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "").trim();
  const legacyProductId = String(formData.get("productId") ?? "").trim();
  const id = listingId || legacyProductId;
  if (!id) return;
  await setCartQuantity(id, 0);
}
