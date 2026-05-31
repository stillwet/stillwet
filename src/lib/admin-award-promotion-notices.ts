import { revalidatePath } from "next/cache";
import { PromotionKind } from "@/generated/prisma/enums";
import { promotionKindLabel } from "@/lib/promotions";
import { prisma } from "@/lib/prisma";

export const SHOP_FLAIR_ACCESS_GRANTED_NOTICE_KIND = "flair_access_granted";
export const SHOP_PROMOTION_CREDIT_GRANTED_NOTICE_KIND = "promotion_credit_granted";
export const SHOP_GOOGLE_SHOPPING_CREDIT_GRANTED_NOTICE_KIND = "google_shopping_credit_granted";

export async function notifyShopFlairAccessGranted(args: { shopId: string }): Promise<void> {
  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: SHOP_FLAIR_ACCESS_GRANTED_NOTICE_KIND,
      body: "You've received shop flair access from the platform. Choose your flair on Shop upgrades!",
    },
  });
  revalidatePath("/dashboard");
}

export async function notifyShopPromotionCreditsGranted(args: {
  shopId: string;
  kind: PromotionKind;
  creditsGranted: number;
  totalCredits: number;
}): Promise<void> {
  const label = promotionKindLabel(args.kind);
  const n = args.creditsGranted;
  const body =
    n === 1
      ? `You've received 1 ${label} promotion credit from the platform. Use it on Shop upgrades → Promotions.`
      : `You've received ${n} ${label} promotion credits from the platform. You now have ${args.totalCredits}. Use them on Shop upgrades → Promotions.`;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: SHOP_PROMOTION_CREDIT_GRANTED_NOTICE_KIND,
      body,
    },
  });
  revalidatePath("/dashboard");
}

export async function notifyShopGoogleShoppingCreditsGranted(args: {
  shopId: string;
  creditsGranted: number;
  totalCredits: number;
}): Promise<void> {
  const n = args.creditsGranted;
  const body =
    n === 1
      ? "You've received 1 Google Shopping credit from the platform. Use it on Shop upgrades."
      : `You've received ${n} Google Shopping credits from the platform. You now have ${args.totalCredits}. Use them on Shop upgrades.`;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: SHOP_GOOGLE_SHOPPING_CREDIT_GRANTED_NOTICE_KIND,
      body,
    },
  });
  revalidatePath("/dashboard");
}
