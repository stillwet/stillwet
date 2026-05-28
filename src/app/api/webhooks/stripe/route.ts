import { NextResponse } from "next/server";
import { after } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { splitCheckoutTipCents } from "@/lib/checkout-tip";
import { getStripe } from "@/lib/stripe";
import { fulfillPaidOrderPrintify } from "@/lib/order-printify-fulfillment";
import { Prisma } from "@/generated/prisma/client";
import { OrderProceedsRouting, OrderStatus } from "@/generated/prisma/enums";
import { fulfillListingCreditPackPurchaseIfPending } from "@/lib/listing-credit-pack-fulfillment";
import { fulfillShopFlairPurchaseIfPending } from "@/lib/shop-flair-fulfillment";
import { fulfillShopGoogleShoppingPurchaseIfPending } from "@/lib/shop-google-shopping-fulfillment";
import { fulfillListingFeeForShopListingIfUnpaid } from "@/lib/listing-fee-fulfillment";
import { fulfillPromotionPurchasePaidIfPending } from "@/lib/promotion-fulfillment";
import { fulfillShopSetupFeeCheckoutSession } from "@/lib/shop-setup-fee-fulfillment";
import { fulfillCreatorGiftCheckoutSession } from "@/lib/creator-gift-fulfillment";
import { fulfillShopReactivationCheckoutSession } from "@/lib/shop-reactivation-fulfillment";

export const runtime = "nodejs";

/**
 * Listing-fee Checkout Sessions (no `Order` row). Returns true when this event was handled here.
 */
async function fulfillListingFeeCheckout(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.metadata?.kind !== "listing_fee") return false;
  const listingId = session.metadata.shopListingId;
  if (!listingId || typeof listingId !== "string") return true;
  const fromTotal =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total
      : undefined;
  const fromMeta = session.metadata?.feeCents
    ? parseInt(String(session.metadata.feeCents), 10)
    : NaN;
  const paidPublicationFeeCents =
    fromTotal ??
    (Number.isFinite(fromMeta) ? fromMeta : undefined);
  await fulfillListingFeeForShopListingIfUnpaid(listingId, {
    ...(paidPublicationFeeCents !== undefined
      ? { paidPublicationFeeCents }
      : {}),
  });
  return true;
}

async function fulfillListingFeePaymentIntent(pi: Stripe.PaymentIntent): Promise<boolean> {
  if (pi.metadata?.kind !== "listing_fee") return false;
  const listingId = pi.metadata.shopListingId;
  if (!listingId || typeof listingId !== "string") return true;
  if (pi.status !== "succeeded") return true;
  const paidPublicationFeeCents =
    typeof pi.amount === "number" && Number.isFinite(pi.amount) ? pi.amount : undefined;
  await fulfillListingFeeForShopListingIfUnpaid(listingId, {
    ...(paidPublicationFeeCents !== undefined ? { paidPublicationFeeCents } : {}),
  });
  return true;
}

async function fulfillListingCreditPackPaymentIntent(pi: Stripe.PaymentIntent): Promise<boolean> {
  if (pi.metadata?.kind !== "listing_credit_pack") return false;
  const purchaseId = pi.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (pi.status !== "succeeded") return true;
  const paidAmountCents =
    typeof pi.amount === "number" && Number.isFinite(pi.amount) ? pi.amount : undefined;
  await fulfillListingCreditPackPurchaseIfPending(purchaseId, {
    paymentIntentId: pi.id,
    ...(paidAmountCents !== undefined ? { paidAmountCents } : {}),
  });
  return true;
}

async function fulfillShopFlairAccessPaymentIntent(pi: Stripe.PaymentIntent): Promise<boolean> {
  if (pi.metadata?.kind !== "shop_flair_access") return false;
  const purchaseId = pi.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (pi.status !== "succeeded") return true;
  const paidAmountCents =
    typeof pi.amount === "number" && Number.isFinite(pi.amount) ? pi.amount : undefined;
  await fulfillShopFlairPurchaseIfPending(purchaseId, {
    paymentIntentId: pi.id,
    ...(paidAmountCents !== undefined ? { paidAmountCents } : {}),
  });
  return true;
}

async function fulfillShopGoogleShoppingPaymentIntent(pi: Stripe.PaymentIntent): Promise<boolean> {
  const kind = pi.metadata?.kind;
  if (kind !== "shop_google_shopping_pack" && kind !== "shop_google_shopping_access") {
    return false;
  }
  const purchaseId = pi.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (pi.status !== "succeeded") return true;
  const paidAmountCents =
    typeof pi.amount === "number" && Number.isFinite(pi.amount) ? pi.amount : undefined;
  await fulfillShopGoogleShoppingPurchaseIfPending(purchaseId, {
    paymentIntentId: pi.id,
    ...(paidAmountCents !== undefined ? { paidAmountCents } : {}),
  });
  return true;
}

async function fulfillPromotionCheckoutSession(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.metadata?.kind !== "promotion_checkout") return false;
  const purchaseId = session.metadata.promotionPurchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (session.payment_status !== "paid") return true;

  const paidAmountCents =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total
      : undefined;

  let paymentIntentId = "";
  let chargeId: string | null = null;
  const piRaw = session.payment_intent;
  if (typeof piRaw === "string") {
    paymentIntentId = piRaw;
  } else if (piRaw && typeof piRaw === "object" && "id" in piRaw) {
    paymentIntentId = String((piRaw as { id: string }).id);
    const chargeRaw = (piRaw as { latest_charge?: string | { id: string } | null }).latest_charge;
    if (typeof chargeRaw === "string") chargeId = chargeRaw;
    else if (chargeRaw && typeof chargeRaw === "object" && "id" in chargeRaw) {
      chargeId = String(chargeRaw.id);
    }
  }

  if (!paymentIntentId) return true;

  await fulfillPromotionPurchasePaidIfPending(purchaseId, {
    paymentIntentId,
    chargeId,
    paidAmountCents,
  });
  return true;
}

async function fulfillPromotionPaymentIntent(pi: Stripe.PaymentIntent): Promise<boolean> {
  if (pi.metadata?.kind !== "promotion") return false;
  const purchaseId = pi.metadata.promotionPurchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (pi.status !== "succeeded") return true;
  const chargeIdRaw = pi.latest_charge;
  const chargeId =
    typeof chargeIdRaw === "string"
      ? chargeIdRaw
      : chargeIdRaw && typeof chargeIdRaw === "object" && chargeIdRaw && "id" in chargeIdRaw
        ? String((chargeIdRaw as { id: string }).id)
        : null;
  await fulfillPromotionPurchasePaidIfPending(purchaseId, {
    paymentIntentId: pi.id,
    chargeId,
    paidAmountCents:
      typeof pi.amount === "number" && Number.isFinite(pi.amount) ? pi.amount : undefined,
  });
  return true;
}

/** Voluntary platform tip — no Order row; acknowledge so we don’t treat it as a merch checkout. */
async function fulfillSupportTipCheckout(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.metadata?.kind !== "support_tip") return false;
  const cents =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total
      : 0;
  const currency =
    typeof session.currency === "string" && session.currency.trim()
      ? session.currency.trim().toLowerCase()
      : "usd";
  if (cents <= 0) return true;
  // Idempotent: webhook handler already gates by ProcessedStripeEvent, but this also protects manual replays.
  await prisma.supportTip.upsert({
    where: { stripeCheckoutSessionId: session.id },
    create: {
      stripeCheckoutSessionId: session.id,
      amountCents: cents,
      currency,
      createdAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000),
    },
    update: {},
  });
  return true;
}

async function fulfillOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) return;

  const stripe = getStripe();
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["customer_details"],
  });

  const email =
    full.customer_details?.email ?? full.customer_email ?? session.customer_email ?? null;
  const phone = full.customer_details?.phone ?? "";
  const shipping = full.collected_information?.shipping_details;
  const shipName = shipping?.name ?? "";
  const addr = shipping?.address;

  const paymentIntentId =
    typeof full.payment_intent === "string"
      ? full.payment_intent
      : full.payment_intent?.id ?? null;

  let orderNewlyPaid = false;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.pending_payment },
      data: {
        status: OrderStatus.paid,
        email,
        stripePaymentIntentId: paymentIntentId,
        shippingName: shipName || null,
        shippingLine1: addr?.line1 ?? null,
        shippingLine2: addr?.line2 ?? null,
        shippingCity: addr?.city ?? null,
        shippingState: addr?.state ?? null,
        shippingPostal: addr?.postal_code ?? null,
        shippingCountry: addr?.country ?? null,
        shippingPhone: phone || null,
      },
    });

    if ((updated?.count ?? 0) === 0) return;
    orderNewlyPaid = true;

    const merchandiseCents = order.lines.reduce(
      (s, l) => s + l.unitPriceCents * l.quantity,
      0,
    );
    const { shopTipCents } = splitCheckoutTipCents(order.tipCents);
    const shopSalesIncrementCents =
      order.proceedsRouting === OrderProceedsRouting.platform_inactivity_deactivated
        ? 0
        : merchandiseCents + shopTipCents;
    if (order.shopId && shopSalesIncrementCents > 0) {
      await tx.shop.update({
        where: { id: order.shopId },
        data: { totalSalesCents: { increment: shopSalesIncrementCents } },
      });
    }
  });

  if (
    orderNewlyPaid &&
    order.shopId &&
    order.proceedsRouting !== OrderProceedsRouting.platform_inactivity_deactivated
  ) {
    const { notifyShopNewSale } = await import("@/lib/shop-new-sale-notice");
    void notifyShopNewSale({ shopId: order.shopId, orderId });
  }

  if (orderNewlyPaid) {
    after(async () => {
      try {
        await fulfillPaidOrderPrintify(orderId);
      } catch (e) {
        console.error("[webhook] deferred Printify fulfillment failed", e);
      }
    });
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await prisma.processedStripeEvent.create({
      data: { stripeEventId: event.id },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json({ received: true });
    }
    throw e;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingFee = await fulfillListingFeeCheckout(session);
    if (listingFee) {
      return NextResponse.json({ received: true });
    }
    const promotionCheckout = await fulfillPromotionCheckoutSession(session);
    if (promotionCheckout) {
      return NextResponse.json({ received: true });
    }
    const supportTip = await fulfillSupportTipCheckout(session);
    if (supportTip) {
      return NextResponse.json({ received: true });
    }
    const setupFee = await fulfillShopSetupFeeCheckoutSession(session);
    if (setupFee) {
      return NextResponse.json({ received: true });
    }
    const creatorGift = await fulfillCreatorGiftCheckoutSession(session);
    if (creatorGift) {
      return NextResponse.json({ received: true });
    }
    const reactivation = await fulfillShopReactivationCheckoutSession(session);
    if (reactivation) {
      return NextResponse.json({ received: true });
    }
    await fulfillOrder(session);
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const listingFee = await fulfillListingFeePaymentIntent(pi);
    if (listingFee) {
      return NextResponse.json({ received: true });
    }
    const promo = await fulfillPromotionPaymentIntent(pi);
    if (promo) {
      return NextResponse.json({ received: true });
    }
    const creditPack = await fulfillListingCreditPackPaymentIntent(pi);
    if (creditPack) {
      return NextResponse.json({ received: true });
    }
    const shopFlair = await fulfillShopFlairAccessPaymentIntent(pi);
    if (shopFlair) {
      return NextResponse.json({ received: true });
    }
    const googleShopping = await fulfillShopGoogleShoppingPaymentIntent(pi);
    if (googleShopping) {
      return NextResponse.json({ received: true });
    }
  }

  return NextResponse.json({ received: true });
}
