import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCartSessionBadgeReadonly, getShopOwnerSessionReadonly } from "@/lib/session";

export const dynamic = "force-dynamic";

function headerCartBadgeQuantity(items: Record<string, { quantity: number }>): number {
  return Object.values(items).reduce((sum, item) => sum + item.quantity, 0);
}

export async function GET() {
  try {
    const [cart, ownerSession] = await Promise.all([
      getCartSessionBadgeReadonly(),
      getShopOwnerSessionReadonly(),
    ]);
    const owner =
      ownerSession.shopUserId != null
        ? await prisma.shopUser.findUnique({
            where: { id: ownerSession.shopUserId },
            select: { email: true, shop: { select: { displayName: true } } },
          })
        : null;

    return NextResponse.json({
      cartQty: headerCartBadgeQuantity(cart.items),
      shopOwnerEmail: owner?.email,
      shopOwnerDisplayName: owner?.shop.displayName?.trim() || undefined,
    });
  } catch (e) {
    console.error("[api/header-state]", e);
    return NextResponse.json({ cartQty: 0 });
  }
}
