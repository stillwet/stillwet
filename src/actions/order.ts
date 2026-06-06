"use server";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  completeMockPaidOrder,
  isMockCheckoutEnabled,
  parseMockOrderId,
} from "@/lib/checkout-mock";
import { clearCart } from "@/actions/cart";
import { OrderStatus } from "@/generated/prisma/enums";
import { fulfillMerchandiseOrderFromCheckoutSession } from "@/lib/order-checkout-fulfillment";
import { fulfillPaidOrderPrintify } from "@/lib/order-printify-fulfillment";

function checkoutSessionShouldClearCart(session: {
  status: string | null;
  payment_status: string | null;
}): boolean {
  if (session.status === "complete") return true;
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export async function clearCartAfterPaidSession(sessionId: string) {
  const trimmed = sessionId.trim();
  if (!trimmed) return;

  try {
    const mockOrderId = parseMockOrderId(trimmed);
    if (mockOrderId) {
      if (!isMockCheckoutEnabled()) return;
      const outcome = await completeMockPaidOrder(mockOrderId);
      if (outcome === "paid" || outcome === "already_paid") {
        await clearCart();
      }
      return;
    }

    const session = await getStripe().checkout.sessions.retrieve(trimmed);
    if (checkoutSessionShouldClearCart(session)) {
      const orderId =
        typeof session.metadata?.orderId === "string" ? session.metadata.orderId.trim() : "";
      const newlyPaid = orderId
        ? await fulfillMerchandiseOrderFromCheckoutSession(trimmed)
        : false;
      if (newlyPaid && orderId) {
        void fulfillPaidOrderPrintify(orderId).catch((e) => {
          console.error("[clearCartAfterPaidSession] Printify fulfillment failed", e);
        });
      }
      await clearCart();
      return;
    }

    const orderId = session.metadata?.orderId;
    if (typeof orderId === "string" && orderId.trim()) {
      const order = await prisma.order.findUnique({
        where: { id: orderId.trim() },
        select: { stripeSessionId: true, status: true },
      });
      if (
        order?.stripeSessionId === trimmed &&
        (order.status === OrderStatus.paid || session.status === "complete")
      ) {
        await clearCart();
      }
    }
  } catch (e) {
    console.error("[clearCartAfterPaidSession]", e);
  }
}
