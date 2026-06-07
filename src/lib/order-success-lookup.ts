import { parseMockOrderId } from "@/lib/checkout-mock";
import { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** Buyer order number after a successful checkout session (mock or Stripe). */
export async function loadBuyerOrderNumberForSuccessSession(
  sessionId: string,
): Promise<number | null> {
  const trimmed = sessionId.trim();
  if (!trimmed) return null;

  const mockOrderId = parseMockOrderId(trimmed);
  if (mockOrderId) {
    const order = await prisma.order.findUnique({
      where: { id: mockOrderId },
      select: { orderNumber: true, status: true },
    });
    if (order?.status === OrderStatus.paid) return order.orderNumber;
    return null;
  }

  const order = await prisma.order.findUnique({
    where: { stripeSessionId: trimmed },
    select: { orderNumber: true, status: true },
  });
  if (order?.status === OrderStatus.paid) return order.orderNumber;
  return null;
}
