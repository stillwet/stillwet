import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { PromotionKind } from "@/generated/prisma/enums";
import { promotionKindLabel } from "@/lib/promotions";
import {
  promotionGrantsFromPurchase,
  type CreatorGiftPromotionGrantLine,
} from "@/lib/creator-gift-promotion-grants";
import { prisma } from "@/lib/prisma";

export const CREATOR_GIFT_RECEIVED_NOTICE_KIND = "creator_gift_received";

const MAX_GIFT_FROM_NAME_LEN = 80;
export function normalizeGiftFromName(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_GIFT_FROM_NAME_LEN);
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

export function shopFlairGiftLabel(): string {
  return "shop flair access";
}

export type CreatorGiftRollupItem = {
  quantity: number;
  giftLabel: string;
};

function pluralizeGiftLabel(quantity: number, giftLabel: string): string {
  if (quantity === 1) return giftLabel;
  if (giftLabel.endsWith(" credit")) {
    return `${quantity} ${giftLabel}s`;
  }
  return `${quantity} ${giftLabel}s`;
}

function formatEnglishGiftList(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function formatCreatorGiftRollupNoticeBody(args: {
  giftFromName?: string | null;
  items: CreatorGiftRollupItem[];
}): string {
  const parts = args.items
    .filter((item) => item.quantity > 0)
    .map((item) => pluralizeGiftLabel(item.quantity, item.giftLabel));
  if (parts.length === 0) return "";

  const giftList = formatEnglishGiftList(parts);
  const gifterName = normalizeGiftFromName(args.giftFromName);
  if (gifterName) {
    return `${gifterName} gifted you ${giftList}!`;
  }
  return `An anonymous gifter has sent you ${giftList}!`;
}

export function buildCreatorGiftRollupItems(args: {
  listingCreditsGranted: number;
  promotionKind?: PromotionKind | null;
  promotionCreditsGranted?: number;
  promotionGrants?: CreatorGiftPromotionGrantLine[];
  googleShoppingCreditsGranted: number;
  shopFlairIncluded: boolean;
}): CreatorGiftRollupItem[] {
  const items: CreatorGiftRollupItem[] = [];
  if (args.listingCreditsGranted > 0) {
    items.push({
      quantity: args.listingCreditsGranted,
      giftLabel: listingCreditGiftLabel(),
    });
  }
  for (const grant of promotionGrantsFromPurchase(args)) {
    items.push({
      quantity: grant.credits,
      giftLabel: promotionCreditGiftLabel(grant.kind),
    });
  }
  if (args.googleShoppingCreditsGranted > 0) {
    items.push({
      quantity: args.googleShoppingCreditsGranted,
      giftLabel: googleShoppingCreditGiftLabel(),
    });
  }
  if (args.shopFlairIncluded) {
    items.push({ quantity: 1, giftLabel: shopFlairGiftLabel() });
  }
  return items;
}

function scheduleDashboardRevalidationAfterCreatorGiftNotice(): void {
  after(() => {
    try {
      revalidatePath("/dashboard");
    } catch (e) {
      console.error("[creator-gift-notices] revalidatePath failed", e);
    }
  });
}

/** Single dashboard notice summarizing every upgrade in one direct-to-shop gift. */
export async function notifyCreatorGiftReceived(args: {
  shopId: string;
  giftFromName?: string | null;
  listingCreditsGranted: number;
  promotionKind?: PromotionKind | null;
  promotionCreditsGranted?: number;
  promotionGrants?: CreatorGiftPromotionGrantLine[];
  googleShoppingCreditsGranted: number;
  shopFlairIncluded: boolean;
}): Promise<void> {
  const items = buildCreatorGiftRollupItems(args);
  if (items.length === 0) return;

  const body = formatCreatorGiftRollupNoticeBody({
    giftFromName: args.giftFromName,
    items,
  });
  if (!body) return;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId: args.shopId,
      kind: CREATOR_GIFT_RECEIVED_NOTICE_KIND,
      body,
    },
  });
  scheduleDashboardRevalidationAfterCreatorGiftNotice();
}
