"use server";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  isMockCheckoutEnabled,
  MOCK_SESSION_PREFIX,
} from "@/lib/checkout-mock";
import { getCartSessionReadonly } from "@/lib/session";
import {
  CHECKOUT_TIP_STRIPE_TAX_CODE,
  checkoutApplicationFeeCents,
  splitCheckoutTipCents,
  validateCheckoutTipCents,
} from "@/lib/checkout-tip";
import {
  CHECKOUT_MERCHANDISE_STRIPE_TAX_CODE,
  isStripeCheckoutAutomaticTaxEnabled,
  stripeCheckoutAutomaticTax,
} from "@/lib/stripe-checkout-tax";
import {
  buyerStripeTaxServiceFeeCents,
  stripeCheckoutTaxServiceFeeLineItem,
} from "@/lib/stripe-tax-buyer-fee";
import { FulfillmentType, OrderProceedsRouting, OrderStatus } from "@/generated/prisma/enums";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { listingCartUnitCents } from "@/lib/listing-cart-price";
import { listingStripeProductName } from "@/lib/listing-cart-stripe-name";
import { baselineGoodsServicesUnitCents } from "@/lib/baseline-goods-services-unit-cents";
import { splitMerchandiseLineForCheckoutCents } from "@/lib/marketplace-fee";
import {
  shopIsInactivityDeactivated,
  splitMerchandiseLineForInactiveShopCents,
} from "@/lib/shop-inactivity-policy";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";
import {
  PLATFORM_CHECKOUT_SHIPPING_COUNTRIES,
  platformFlatShippingCents,
} from "@/lib/platform-checkout-limits";
import { STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE } from "@/lib/storefront-listing-product-include";
import { resolveAdminCatalogStorefrontText } from "@/lib/storefront-product-detail";
import type { StorefrontProduct } from "@/lib/product-storefront";
import { storefrontListingDisplayTitle } from "@/lib/storefront-listing-display-name";
import { storefrontStripeCheckoutBranding } from "@/lib/stripe-checkout-branding";
import {
  isStorefrontBuyerCheckoutDisabled,
  STOREFRONT_BUYER_CHECKOUT_DISABLED_MESSAGE,
} from "@/lib/storefront-buyer-checkout";

export type CheckoutResult =
  | { ok: true; mode: "redirect"; url: string }
  | { ok: true; mode: "embedded"; clientSecret: string }
  | { ok: false; error: string };

function appUrl() {
  const u = publicAppBaseUrl();
  if (!u) {
    return { ok: false as const, error: "NEXT_PUBLIC_APP_URL is not configured." };
  }
  return { ok: true as const, url: u };
}

export async function startCheckout(formData: FormData): Promise<CheckoutResult> {
  const base = appUrl();
  if (!base.ok) return base;

  if (isStorefrontBuyerCheckoutDisabled()) {
    return { ok: false, error: STOREFRONT_BUYER_CHECKOUT_DISABLED_MESSAGE };
  }

  const session = await getCartSessionReadonly();
  const listingIds = Object.keys(session.items).filter(
    (id) => (session.items[id]?.quantity ?? 0) > 0,
  );
  if (listingIds.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const listings = await prisma.shopListing.findMany({
    where: { id: { in: listingIds }, ...storefrontShopListingWhere },
    include: {
      product: { include: STOREFRONT_LISTING_PRODUCT_RELATION_INCLUDE },
      shop: { select: { id: true, slug: true, inactivityDeactivatedAt: true } },
    },
  });

  if (listings.length === 0) {
    return { ok: false, error: "Some products are no longer available. Refresh your cart." };
  }

  const shopIds = new Set(listings.map((l) => l.shopId));
  if (shopIds.size !== 1) {
    return { ok: false, error: "Your cart mixes different shops. Check out one shop at a time." };
  }
  const shopId = [...shopIds][0]!;
  const shopIsDeactivatedForInactivity = shopIsInactivityDeactivated(listings[0]!.shop);

  const tipRaw = formData.get("tipCents");
  let tipCents = 0;
  if (tipRaw !== null && tipRaw !== "") {
    tipCents = parseInt(String(tipRaw), 10);
  }
  const tipError = validateCheckoutTipCents(tipCents);
  if (tipError) {
    return { ok: false, error: tipError };
  }

  let subtotalCents = 0;
  const lineInputs: {
    listing: (typeof listings)[0];
    product: (typeof listings)[0]["product"];
    quantity: number;
    lineTotal: number;
    unitPriceCents: number;
    stripeProductName: string;
    orderPrintifyVariantId: string | null;
    goodsServicesCostCents: number;
    platformCutCents: number;
    shopCutCents: number;
  }[] = [];

  const baselineCatalogItemIds = new Set<string>();
  for (const listing of listings) {
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded ?? "");
    if (pick && (pick.mode === "item" || pick.mode === "variant" || pick.mode === "allVariants")) {
      baselineCatalogItemIds.add(pick.itemId);
    }
  }
  const baselineCatalogRows =
    baselineCatalogItemIds.size === 0
      ? []
      : await prisma.adminCatalogItem.findMany({
          where: { id: { in: [...baselineCatalogItemIds] } },
          select: { id: true, variants: true, itemGoodsServicesCostCents: true },
        });
  const baselineCatalogById = new Map(baselineCatalogRows.map((r) => [r.id, r]));

  for (const listing of listings) {
    const p = listing.product;
    const cartLine = session.items[listing.id];
    const quantity = cartLine?.quantity ?? 0;
    if (quantity <= 0) continue;

    const unitPriceCents = listingCartUnitCents(listing, cartLine);
    const { name: stripeProductName, printifyVariantId: orderPrintifyVariantId } =
      listingStripeProductName(listing, cartLine);

    if (p.fulfillmentType === FulfillmentType.printify && !orderPrintifyVariantId) {
      const label = storefrontListingDisplayTitle({
        requestItemName: listing.requestItemName,
        product: p,
      });
      return {
        ok: false,
        error: `“${label}” is missing Printify variant data. Remove it from your cart and add it again from the product page.`,
      };
    }

    const lineTotal = unitPriceCents * quantity;
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded ?? "");
    const catalogRow = pick ? baselineCatalogById.get(pick.itemId) : undefined;
    const goodsUnit = baselineGoodsServicesUnitCents({
      baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
      selectedVariantId: orderPrintifyVariantId,
      catalogRow,
      productPrintifyVariantsJson: p.printifyVariants,
    });
    const goodsLine = Math.min(lineTotal, Math.max(0, goodsUnit) * quantity);
    const { goodsServicesCostCents, platformCutCents, shopCutCents } =
      (shopIsDeactivatedForInactivity
        ? splitMerchandiseLineForInactiveShopCents
        : splitMerchandiseLineForCheckoutCents)({
        lineMerchandiseCents: lineTotal,
        goodsServicesLineCents: goodsLine,
      });
    subtotalCents += lineTotal;
    lineInputs.push({
      listing,
      product: p,
      quantity,
      lineTotal,
      unitPriceCents,
      stripeProductName,
      orderPrintifyVariantId,
      goodsServicesCostCents,
      platformCutCents,
      shopCutCents,
    });
  }

  if (lineInputs.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const stripeDescriptionByListingId = new Map(
    await Promise.all(
      lineInputs.map(async (row) => {
        const text = (
          await resolveAdminCatalogStorefrontText(row.product as StorefrontProduct, row.listing)
        ).trim();
        return [row.listing.id, text] as const;
      }),
    ),
  );

  const ship = platformFlatShippingCents();
  const automaticTaxEnabled = isStripeCheckoutAutomaticTaxEnabled();
  const stripeTaxServiceFeeCents = buyerStripeTaxServiceFeeCents({
    subtotalCents,
    shippingCents: ship,
    tipCents,
  });
  const totalCents = subtotalCents + tipCents + ship + stripeTaxServiceFeeCents;

  const stripeLineItems: Array<{
    quantity: number;
    price_data: {
      currency: "usd";
      unit_amount: number;
      tax_behavior: "exclusive";
      product_data: {
        name: string;
        description?: string;
        tax_code?: string;
        metadata?: Record<string, string>;
      };
    };
  }> = [];

  for (const row of lineInputs) {
    const p = row.product;
    stripeLineItems.push({
      quantity: row.quantity,
      price_data: {
        currency: "usd",
        unit_amount: row.unitPriceCents,
        tax_behavior: "exclusive",
        product_data: {
          name: row.stripeProductName,
          description: stripeDescriptionByListingId.get(row.listing.id) || undefined,
          tax_code: CHECKOUT_MERCHANDISE_STRIPE_TAX_CODE,
          metadata: { productId: p.id, shopListingId: row.listing.id },
        },
      },
    });
  }

  if (tipCents > 0) {
    stripeLineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: tipCents,
        tax_behavior: "exclusive",
        product_data: {
          name: "Tip (thank you)",
          tax_code: CHECKOUT_TIP_STRIPE_TAX_CODE,
          metadata: { kind: "checkout_tip" },
        },
      },
    });
  }

  const taxServiceFeeLine = stripeCheckoutTaxServiceFeeLineItem({
    subtotalCents,
    shippingCents: ship,
    tipCents,
    automaticTaxEnabled,
  });
  if (taxServiceFeeLine) {
    stripeLineItems.push(taxServiceFeeLine);
  }

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        shopId,
        status: OrderStatus.pending_payment,
        subtotalCents,
        tipCents,
        shippingCents: ship,
        totalCents,
        currency: "usd",
        proceedsRouting: shopIsDeactivatedForInactivity
          ? OrderProceedsRouting.platform_inactivity_deactivated
          : OrderProceedsRouting.standard,
        lines: {
          create: lineInputs.map(
            ({
              listing,
              product: p,
              quantity,
              unitPriceCents,
              stripeProductName,
              orderPrintifyVariantId,
              goodsServicesCostCents,
              platformCutCents,
              shopCutCents,
            }) => ({
              quantity,
              unitPriceCents,
              productName: stripeProductName,
              fulfillmentType: p.fulfillmentType,
              productId: p.id,
              printifyProductId: listing.listingPrintifyProductId ?? p.printifyProductId,
              printifyVariantId: orderPrintifyVariantId,
              shopId,
              shopListingId: listing.id,
              goodsServicesCostCents,
              platformCutCents,
              shopCutCents,
            }),
          ),
        },
      },
    });
    return o;
  });

  const mockSessionId = `${MOCK_SESSION_PREFIX}${order.id}`;

  if (isMockCheckoutEnabled()) {
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: mockSessionId },
    });
    return {
      ok: true,
      mode: "redirect",
      url: `${base.url}/order/success?session_id=${encodeURIComponent(mockSessionId)}`,
    };
  }

  const lineProducts = lineInputs.map((x) => x.product);
  const allowCard = lineProducts.every((p) => p.payCard);
  const allowCashApp = lineProducts.every((p) => p.payCashApp);
  const payment_method_types: ("card" | "cashapp")[] = [];
  if (allowCard) payment_method_types.push("card");
  if (allowCashApp) payment_method_types.push("cashapp");
  if (payment_method_types.length === 0) payment_method_types.push("card");

  const shopRecord = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      stripeConnectAccountId: true,
      connectChargesEnabled: true,
    },
  });
  const useStripeConnect =
    !shopIsDeactivatedForInactivity &&
    process.env.MARKETPLACE_STRIPE_CONNECT === "1" &&
    shopRecord?.stripeConnectAccountId &&
    shopRecord.connectChargesEnabled;
  const merchandiseApplicationFeeCents = lineInputs.reduce(
    (s, x) => s + x.platformCutCents + x.goodsServicesCostCents,
    0,
  );
  const { platformTipFeeCents } = splitCheckoutTipCents(tipCents);
  const applicationFeeCents =
    checkoutApplicationFeeCents({
      merchandiseApplicationFeeCents,
      tipCents,
    }) + (useStripeConnect ? stripeTaxServiceFeeCents : 0);
  const connectAccountId = useStripeConnect ? shopRecord!.stripeConnectAccountId! : null;

  let checkoutSession;
  try {
    checkoutSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      payment_method_types,
      line_items: stripeLineItems,
      branding_settings: storefrontStripeCheckoutBranding,
      ...(automaticTaxEnabled
        ? { automatic_tax: stripeCheckoutAutomaticTax(connectAccountId) }
        : {}),
      shipping_address_collection: {
        allowed_countries: [...PLATFORM_CHECKOUT_SHIPPING_COUNTRIES],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: ship, currency: "usd" },
            display_name: ship === 0 ? "Free shipping" : "Standard shipping",
            ...(automaticTaxEnabled ? { tax_behavior: "exclusive" as const } : {}),
          },
        },
      ],
      metadata: { orderId: order.id, shopId },
      client_reference_id: order.id,
      return_url: `${base.url}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      ...(useStripeConnect
        ? {
            payment_intent_data: {
              application_fee_amount: applicationFeeCents,
              metadata: {
                orderId: order.id,
                tipCents: String(tipCents),
                platformTipFeeCents: String(platformTipFeeCents),
                stripeTaxServiceFeeCents: String(stripeTaxServiceFeeCents),
              },
              transfer_data: {
                destination: shopRecord.stripeConnectAccountId!,
              },
            },
          }
        : {}),
    });
  } catch (e) {
    await prisma.order.delete({ where: { id: order.id } });
    const message = e instanceof Error ? e.message : "Payment setup failed.";
    return { ok: false, error: message };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: checkoutSession.id },
  });

  const clientSecret = checkoutSession.client_secret;
  if (!clientSecret) {
    return { ok: false, error: "Stripe did not return a checkout session secret." };
  }

  return { ok: true, mode: "embedded", clientSecret };
}
