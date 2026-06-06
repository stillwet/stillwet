import { revalidatePath } from "next/cache";
import { SHOP_NEW_SALE_NOTICE_KIND, shopNewSaleNoticeBody } from "@/lib/shop-new-sale-notice-content";
import { prisma } from "@/lib/prisma";
import { invalidateShopSalesDashboardSnapshot } from "@/lib/shop-sales-dashboard-snapshot";

export { SHOP_NEW_SALE_NOTICE_KIND, shopNewSaleNoticeBody } from "@/lib/shop-new-sale-notice-content";

/** One notice per paid order (idempotent for webhook retries). */
export async function notifyShopNewSale(args: {
  shopId: string;
  orderId: string;
}): Promise<void> {
  const { shopId, orderId } = args;
  const existing = await prisma.shopOwnerNotice.findFirst({
    where: { shopId, kind: SHOP_NEW_SALE_NOTICE_KIND, relatedOrderId: orderId },
    select: { id: true },
  });
  if (existing) {
    await invalidateShopSalesDashboardSnapshot(shopId);
    return;
  }

  try {
    await prisma.shopOwnerNotice.create({
      data: {
        shopId,
        kind: SHOP_NEW_SALE_NOTICE_KIND,
        body: shopNewSaleNoticeBody(),
        relatedOrderId: orderId,
      },
    });
    await invalidateShopSalesDashboardSnapshot(shopId);
    revalidatePath("/dashboard");
  } catch (e) {
    console.warn("[notifyShopNewSale]", shopId, orderId, e);
  }
}
