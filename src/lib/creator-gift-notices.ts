import { revalidatePath } from "next/cache";
import { PromotionKind } from "@/generated/prisma/enums";
import { promotionKindLabel } from "@/lib/promotions";
import { prisma } from "@/lib/prisma";

export const CREATOR_GIFT_LISTING_CREDITS_NOTICE_KIND = "creator_gift_listing_credits";
export const CREATOR_GIFT_PROMOTION_CREDITS_NOTICE_KIND = "creator_gift_promotion_credits";
export const CREATOR_GIFT_GOOGLE_SHOPPING_CREDITS_NOTICE_KIND = "creator_gift_google_shopping_credits";
export const CREATOR_GIFT_SHOP_FLAIR_NOTICE_KIND = "creator_gift_shop_flair";

const MAX_GIFT_FROM_NAME_LEN = 80;

export function normalizeGiftFromName(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_GIFT_FROM_NAME_LEN);
}

export function formatCreatorGiftNoticeBody(args: {
  giftFromName?: string | null;
  giftLabel: string;
  quantity: number;
}): string {
  const quantity = args.quantity;
  const label =
    quantity === 1
      ? args.giftLabel
      : args.giftLabel.endsWith(" credit")
        ? `${args.giftLabel}s`
        : `${args.giftLabel}s`;

  const gifterName = normalizeGiftFromName(args.giftFromName);
  if (gifterName) {
    return `${gifterName} gifted you ${quantity} ${label}!`;
  }
  return `An anonymous gifter has sent you ${quantity} ${label}!`;
}

export function listingCreditGiftLabel(): string {
  return "listing credit";
}

export function googleShoppingCreditGiftLabel(): string {
  return "Google Shopping credit";
}

export function promotionCreditGiftLabel(kind: PromotionKind): string {
  return `${promotionKindLabel(kind)} credit`;
}

export async function notifyCreatorGiftListingCredits(args: {
  shopId: string;
  creditsGranted: number;
  giftFromName?: string | null;
}): Promise<void> {
  if (args.creditsGranted <= 0) return;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: CREATOR_GIFT_LISTING_CREDITS_NOTICE_KIND,
      body: formatCreatorGiftNoticeBody({
        giftFromName: args.giftFromName,
        giftLabel: listingCreditGiftLabel(),
        quantity: args.creditsGranted,
      }),
    },
  });
  revalidatePath("/dashboard");
}

export async function notifyCreatorGiftPromotionCredits(args: {
  shopId: string;
  kind: PromotionKind;
  creditsGranted: number;
  giftFromName?: string | null;
}): Promise<void> {
  if (args.creditsGranted <= 0) return;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: CREATOR_GIFT_PROMOTION_CREDITS_NOTICE_KIND,
      body: formatCreatorGiftNoticeBody({
        giftFromName: args.giftFromName,
        giftLabel: promotionCreditGiftLabel(args.kind),
        quantity: args.creditsGranted,
      }),
    },
  });
  revalidatePath("/dashboard");
}

export function shopFlairGiftLabel(): string {
  return "shop flair access";
}

export async function notifyCreatorGiftShopFlair(args: {
  shopId: string;
  giftFromName?: string | null;
}): Promise<void> {
  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: CREATOR_GIFT_SHOP_FLAIR_NOTICE_KIND,
      body: formatCreatorGiftNoticeBody({
        giftFromName: args.giftFromName,
        giftLabel: shopFlairGiftLabel(),
        quantity: 1,
      }),
    },
  });
  revalidatePath("/dashboard");
}

export async function notifyCreatorGiftGoogleShoppingCredits(args: {
  shopId: string;
  creditsGranted: number;
  giftFromName?: string | null;
}): Promise<void> {
  if (args.creditsGranted <= 0) return;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: CREATOR_GIFT_GOOGLE_SHOPPING_CREDITS_NOTICE_KIND,
      body: formatCreatorGiftNoticeBody({
        giftFromName: args.giftFromName,
        giftLabel: googleShoppingCreditGiftLabel(),
        quantity: args.creditsGranted,
      }),
    },
  });
  revalidatePath("/dashboard");
}
