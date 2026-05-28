import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const SHOP_FREE_LISTING_SLOTS_GRANTED_NOTICE_KIND = "free_listing_slots_granted";

/** Dashboard notification when admin grants bonus publication-fee-free listing slots. */
export async function notifyShopFreeListingSlotsGranted(args: {
  shopId: string;
  slotsGranted: number;
  totalBonusSlots: number;
  totalFreeCap: number;
}): Promise<void> {
  const { shopId, slotsGranted } = args;

  const body =
    slotsGranted === 1
      ? "You've received 1 extra free listing from the platform. Enjoy!"
      : `You've received ${slotsGranted} extra free listings from the platform. Enjoy!`;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId,
      kind: SHOP_FREE_LISTING_SLOTS_GRANTED_NOTICE_KIND,
      body,
    },
  });

  revalidatePath("/dashboard");
}
