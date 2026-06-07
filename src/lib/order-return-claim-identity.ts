import { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  ORDER_RETURN_CLAIM_OUTSIDE_WINDOW_MESSAGE,
  isWithinOrderReturnClaimWindow,
} from "@/lib/order-return-claim-limits";
import { verifyOrderPaymentCardLast4 } from "@/lib/order-return-claim-stripe-verify";
import {
  buyerOrderEmailMatches,
  buyerOrderNameMatches,
  parseBuyerOrderNumberInput,
} from "@/lib/order-return-claim-validation";

export const ORDER_RETURN_CLAIM_NAME_MAX = 200;
export const ORDER_RETURN_CLAIM_EMAIL_MAX = 320;

export type OrderReturnClaimIdentityField =
  | "orderNumber"
  | "email"
  | "nameOnOrder"
  | "cardLast4";

export type OrderReturnClaimIdentityInput = {
  orderNumberRaw: string;
  email: string;
  cardLast4: string;
  nameOnOrder: string;
};

export type ValidatedOrderReturnClaimIdentity = {
  orderId: string;
  orderNumber: number;
  email: string;
  cardLast4: string;
  nameOnOrder: string;
};

export type OrderReturnClaimIdentityError = {
  error: string;
  field: OrderReturnClaimIdentityField;
  outsideWindow?: boolean;
};

export type OrderReturnClaimIdentityResult =
  | { ok: true; identity: ValidatedOrderReturnClaimIdentity }
  | ({ ok: false } & OrderReturnClaimIdentityError);

export function readIdentityFromFormData(formData: FormData): OrderReturnClaimIdentityInput {
  return {
    orderNumberRaw: String(formData.get("orderNumber") ?? ""),
    email: String(formData.get("email") ?? ""),
    cardLast4: String(formData.get("cardLast4") ?? ""),
    nameOnOrder: String(formData.get("nameOnOrder") ?? ""),
  };
}

function parseIdentityFields(
  input: OrderReturnClaimIdentityInput,
): { ok: true; parsed: ValidatedOrderReturnClaimIdentity } | ({ ok: false } & OrderReturnClaimIdentityError) {
  const orderNumberRaw = input.orderNumberRaw.trim();
  const email = input.email.trim();
  const cardLast4 = input.cardLast4.trim();
  const nameOnOrder = input.nameOnOrder.trim();

  if (!orderNumberRaw) {
    return { ok: false, error: "Order number is required.", field: "orderNumber" };
  }
  if (!email) {
    return { ok: false, error: "Email address is required.", field: "email" };
  }
  if (!cardLast4) {
    return { ok: false, error: "Last 4 digits of card are required.", field: "cardLast4" };
  }
  if (!/^\d{4}$/.test(cardLast4)) {
    return {
      ok: false,
      error: "Enter the last 4 digits of the card used at checkout.",
      field: "cardLast4",
    };
  }
  if (!nameOnOrder) {
    return { ok: false, error: "Name on order is required.", field: "nameOnOrder" };
  }
  if (nameOnOrder.length > ORDER_RETURN_CLAIM_NAME_MAX) {
    return { ok: false, error: "Name on order is too long.", field: "nameOnOrder" };
  }
  if (email.length > ORDER_RETURN_CLAIM_EMAIL_MAX) {
    return { ok: false, error: "Email address is too long.", field: "email" };
  }

  const orderNumber = parseBuyerOrderNumberInput(orderNumberRaw);
  if (orderNumber == null) {
    return {
      ok: false,
      error: "Enter a valid order number (for example #1234).",
      field: "orderNumber",
    };
  }

  return {
    ok: true,
    parsed: {
      orderId: "",
      orderNumber,
      email,
      cardLast4,
      nameOnOrder,
    },
  };
}

export async function validateOrderReturnClaimIdentity(
  input: OrderReturnClaimIdentityInput,
): Promise<OrderReturnClaimIdentityResult> {
  const fields = parseIdentityFields(input);
  if (!fields.ok) return fields;

  const { orderNumber, email, cardLast4, nameOnOrder } = fields.parsed;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      email: true,
      shippingName: true,
      status: true,
      createdAt: true,
      stripePaymentIntentId: true,
    },
  });

  if (!order || order.status !== OrderStatus.paid) {
    return {
      ok: false,
      error: "We couldn't find a paid order with that number.",
      field: "orderNumber",
    };
  }

  if (!isWithinOrderReturnClaimWindow(order.createdAt)) {
    return {
      ok: false,
      error: ORDER_RETURN_CLAIM_OUTSIDE_WINDOW_MESSAGE,
      field: "orderNumber",
      outsideWindow: true,
    };
  }

  if (!buyerOrderEmailMatches(order.email, email)) {
    return {
      ok: false,
      error: "Email address does not match this order.",
      field: "email",
    };
  }

  if (!buyerOrderNameMatches(order.shippingName, nameOnOrder)) {
    return {
      ok: false,
      error: "Name does not match this order.",
      field: "nameOnOrder",
    };
  }

  const cardOk = await verifyOrderPaymentCardLast4(order.stripePaymentIntentId, cardLast4);
  if (!cardOk.ok) {
    return {
      ok: false,
      error: "Last 4 digits do not match the card used for this order.",
      field: "cardLast4",
    };
  }

  return {
    ok: true,
    identity: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      email,
      cardLast4,
      nameOnOrder,
    },
  };
}
