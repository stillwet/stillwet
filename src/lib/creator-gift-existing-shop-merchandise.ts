import {
  type CreatorGiftPromotionGrantLine,
  promotionGrantsMerchandiseCents,
} from "@/lib/creator-gift-promotion-grants";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";

/** Merchandise subtotal for an existing-shop creator gift (excludes Stripe processing fee). */
export function existingShopGiftMerchandiseSubtotalCents(args: {
  listingPackPriceCents: number;
  googlePackPriceCents: number;
  promotionGrants: CreatorGiftPromotionGrantLine[];
  includeShopFlair: boolean;
}): number {
  return (
    args.listingPackPriceCents +
    args.googlePackPriceCents +
    promotionGrantsMerchandiseCents(args.promotionGrants) +
    (args.includeShopFlair ? SHOP_FLAIR_ACCESS_PRICE_CENTS : 0)
  );
}
