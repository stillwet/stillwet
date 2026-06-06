import type Stripe from "stripe";
import { OrderProceedsRouting, OrderStatus } from "@/generated/prisma/enums";
import { splitCheckoutTipCents } from "@/lib/checkout-tip";
import { prisma } from "@/lib/prisma";
import { notifyShopNewSale } from "@/lib/shop-new-sale-notice";
import { getStripe } from "@/lib/stripe";

function checkoutSessionIsPaid(session: Pick<Stripe.Checkout.Session, "status" | "payment_status">): boolean {
  if (session.status === "complete") return true;
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

/**
 * Marks a merchandise {@link Order} paid from a Stripe Checkout Session (idempotent).
 * Used by the Stripe webhook and the buyer success page when webhooks lag or fail.
 */
export async function fulfillMerchandiseOrderFromCheckoutSession(
  sessionOrId: Stripe.Checkout.Session | string,
): Promise<boolean> {
  const sessionId = typeof sessionOrId === "string" ? sessionOrId : sessionOrId.id;
  const full = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["customer_details"],
  });

  if (!checkoutSessionIsPaid(full)) return false;

  const orderId = full.metadata?.orderId;
  if (!orderId || typeof orderId !== "string") return false;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) return false;

  const email =
    full.customer_details?.email ?? full.customer_email ?? null;
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
    await notifyShopNewSale({ shopId: order.shopId, orderId });
  }

  return orderNewlyPaid;
}
