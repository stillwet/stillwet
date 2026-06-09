import type { Prisma } from "@/generated/prisma/client";
import { PromotionKind } from "@/generated/prisma/enums";

/** Stable keys for platform-wide per-product transaction sequences. */
export const PLATFORM_TRANSACTION_PRODUCT = {
  support_platform: "support_platform",
  shop_creation_fee: "shop_creation_fee",
  shop_reactivation_fee: "shop_reactivation_fee",
  featured_shop_promo: "featured_shop_promo",
  hot_item_promo: "hot_item_promo",
  popular_item_promo: "popular_item_promo",
  front_page_item_promo: "front_page_item_promo",
  gshop_listing_upgrade: "gshop_listing_upgrade",
  listing_credits: "listing_credits",
  shop_flair: "shop_flair",
} as const;

export type PlatformTransactionProduct =
  (typeof PLATFORM_TRANSACTION_PRODUCT)[keyof typeof PLATFORM_TRANSACTION_PRODUCT];

const DISPLAY_NAMES: Record<PlatformTransactionProduct, string> = {
  support_platform: "Support Platform",
  shop_creation_fee: "Shop Creation Fee",
  shop_reactivation_fee: "Shop Reactivation Fee",
  featured_shop_promo: "Featured Shop Promo",
  hot_item_promo: "Hot Item Promo",
  popular_item_promo: "Popular Item Promo",
  front_page_item_promo: "Front Page Item Promo",
  gshop_listing_upgrade: "G-Shop Listing Upgrade",
  listing_credits: "Listing Credits",
  shop_flair: "Shop Flair",
};

export function platformTransactionDisplayName(product: PlatformTransactionProduct): string {
  return DISPLAY_NAMES[product];
}

export function promotionKindToPlatformTransactionProduct(
  kind: PromotionKind,
): PlatformTransactionProduct {
  switch (kind) {
    case PromotionKind.FEATURED_SHOP_HOME:
      return PLATFORM_TRANSACTION_PRODUCT.featured_shop_promo;
    case PromotionKind.HOT_FEATURED_ITEM:
      return PLATFORM_TRANSACTION_PRODUCT.hot_item_promo;
    case PromotionKind.MOST_POPULAR_OF_TAG_ITEM:
      return PLATFORM_TRANSACTION_PRODUCT.popular_item_promo;
    case PromotionKind.FRONT_PAGE_ITEM:
      return PLATFORM_TRANSACTION_PRODUCT.front_page_item_promo;
    default:
      return PLATFORM_TRANSACTION_PRODUCT.hot_item_promo;
  }
}

/** Stripe / UI label: `{Display Name} - #{N}` with optional ` (Gift)` suffix. */
export function formatPlatformTransactionReference(
  product: PlatformTransactionProduct,
  transactionNumber: number,
  options?: { gift?: boolean },
): string {
  const base = `${platformTransactionDisplayName(product)} - #${transactionNumber}`;
  return options?.gift ? `${base} (Gift)` : base;
}

type TransactionClient = Pick<
  Prisma.TransactionClient,
  "platformTransactionSequence"
>;

/** Atomically allocate the next platform-wide number for a product type. */
export async function allocatePlatformTransactionNumber(
  tx: TransactionClient,
  product: PlatformTransactionProduct,
): Promise<number> {
  await tx.platformTransactionSequence.upsert({
    where: { productKey: product },
    create: { productKey: product, lastNumber: 0 },
    update: {},
  });
  const row = await tx.platformTransactionSequence.update({
    where: { productKey: product },
    data: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return row.lastNumber;
}

export function stripePlatformTransactionMetadata(
  product: PlatformTransactionProduct,
  transactionNumber: number,
  options?: { gift?: boolean },
): Record<string, string> {
  return {
    platformTransactionProduct: product,
    platformTransactionNumber: String(transactionNumber),
    ...(options?.gift ? { platformTransactionGift: "1" } : {}),
  };
}

export function stripePlatformTransactionReferenceFields(
  product: PlatformTransactionProduct,
  transactionNumber: number,
  options?: { gift?: boolean },
): {
  description: string;
  lineItemName: string;
  metadata: Record<string, string>;
} {
  const label = formatPlatformTransactionReference(product, transactionNumber, options);
  return {
    description: label,
    lineItemName: label,
    metadata: stripePlatformTransactionMetadata(product, transactionNumber, options),
  };
}

/** Prefer stored number + kind when present; otherwise fall back to legacy label. */
export function promotionPurchaseReferenceLabel(input: {
  kind: PromotionKind | string;
  transactionNumber?: number | null;
}): string | null {
  if (input.transactionNumber == null || !Number.isFinite(input.transactionNumber)) {
    return null;
  }
  const kind =
    typeof input.kind === "string"
      ? (Object.values(PromotionKind).includes(input.kind as PromotionKind)
          ? (input.kind as PromotionKind)
          : null)
      : input.kind;
  if (!kind) return null;
  return formatPlatformTransactionReference(
    promotionKindToPlatformTransactionProduct(kind),
    input.transactionNumber,
  );
}

export function platformTransactionReferenceLabel(
  product: PlatformTransactionProduct,
  transactionNumber?: number | null,
  options?: { gift?: boolean },
): string | null {
  if (transactionNumber == null || !Number.isFinite(transactionNumber)) return null;
  return formatPlatformTransactionReference(product, transactionNumber, options);
}
