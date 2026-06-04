import { prisma } from "@/lib/prisma";
import { OrderStatus, OrderProceedsRouting } from "@/generated/prisma/enums";
import { isStripeSecretConfigured } from "@/lib/stripe";
import { splitCheckoutTipCents } from "@/lib/checkout-tip";

/** Prefix for fake Stripe session ids when MOCK_CHECKOUT=1. */
export const MOCK_SESSION_PREFIX = "mock_" as const;

/**
 * Use mock / demo payments (no Stripe keys, no card UI). Set either env in `.env.local`:
 * - `DEMO_MODE=1` — preferred name for local work before Stripe is configured
 * - `MOCK_CHECKOUT=1` — legacy alias (same behavior)
 */
export function isMockCheckoutEnabled(): boolean {
  return process.env.MOCK_CHECKOUT === "1" || process.env.DEMO_MODE === "1";
}

/**
 * Dashboard promotion purchases only: show mock / demo pay (no Stripe) for this shop.
 *
 * - **Local / dev:** `DEMO_MODE=1` or `MOCK_CHECKOUT=1` enables mock pay for all shops (see {@link isMockCheckoutEnabled}).
 * - **Staging / production testing:** set `PROMOTION_DEMO_CHECKOUT=1` and list allowed storefront slugs in
 *   `PROMOTION_DEMO_SHOP_SLUGS` (comma-separated). In **production**, if the allowlist is empty, demo pay stays **off**
 *   even when `PROMOTION_DEMO_CHECKOUT=1` (prevents accidentally opening mock pay to every shop).
 */
export function isStripePublishableConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
}

/** Platform can charge promotion purchases with Stripe.js + PaymentIntents. */
export function promotionStripePaymentsAvailable(): boolean {
  return isStripeSecretConfigured() && isStripePublishableConfigured();
}

/**
 * Dashboard promotion UI: mock/demo pay only when Stripe is not configured.
 * When `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are set, promotions use real card pay
 * even if `DEMO_MODE=1` / `MOCK_CHECKOUT=1` (listing fees may still use mock via {@link isMockCheckoutEnabled}).
 */
export function promotionUiUsesMockCheckout(shopSlug: string): boolean {
  if (promotionStripePaymentsAvailable()) return false;
  return allowPromotionMockPay(shopSlug);
}

export function allowPromotionMockPay(shopSlug: string): boolean {
  if (isMockCheckoutEnabled()) return true;
  if (process.env.PROMOTION_DEMO_CHECKOUT !== "1") return false;

  const allowlistRaw = process.env.PROMOTION_DEMO_SHOP_SLUGS?.trim() ?? "";
  const normalizedSlug = shopSlug.trim().toLowerCase();
  if (process.env.NODE_ENV === "production") {
    if (!allowlistRaw) return false;
    return allowlistRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(normalizedSlug);
  }
  if (!allowlistRaw) return true;
  return allowlistRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedSlug);
}

export function parseMockOrderId(sessionId: string): string | null {
  if (!sessionId.startsWith(MOCK_SESSION_PREFIX)) return null;
  const id = sessionId.slice(MOCK_SESSION_PREFIX.length);
  return id.length > 0 ? id : null;
}

const expectedMockSessionId = (orderId: string) => `${MOCK_SESSION_PREFIX}${orderId}`;

/**
 * Marks a mock order paid (mirrors webhook order status transition).
 * Does not call Stripe or Printify.
 */
export async function completeMockPaidOrder(
  orderId: string,
): Promise<"paid" | "already_paid" | "invalid"> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) return "invalid";

  if (order.status === OrderStatus.paid) {
    return order.stripeSessionId === expectedMockSessionId(orderId)
      ? "already_paid"
      : "invalid";
  }

  if (order.status !== OrderStatus.pending_payment) return "invalid";

  const mockPi = `mock_pi_${orderId}`;

  let transitioned = false;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.pending_payment },
      data: {
        status: OrderStatus.paid,
        stripePaymentIntentId: mockPi,
      },
    });
    if ((updated?.count ?? 0) === 0) return;
    transitioned = true;

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

  if (transitioned) {
    if (order.shopId) {
      const { notifyShopNewSale } = await import("@/lib/shop-new-sale-notice");
      void notifyShopNewSale({ shopId: order.shopId, orderId });
    }
    return "paid";
  }

  const again = await prisma.order.findUnique({ where: { id: orderId } });
  if (
    again?.status === OrderStatus.paid &&
    again.stripeSessionId === expectedMockSessionId(orderId)
  ) {
    return "already_paid";
  }
  return "invalid";
}
