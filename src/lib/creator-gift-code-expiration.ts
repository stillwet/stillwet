/** Purchased shop-setup gift codes are redeemable for this many days after issuance. */
export const PURCHASED_SHOP_SETUP_GIFT_CODE_VALIDITY_DAYS = 365;

export function purchasedShopSetupGiftCodeExpiresAt(from: Date = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + PURCHASED_SHOP_SETUP_GIFT_CODE_VALIDITY_DAYS);
  return expiresAt;
}

/** Prefer stored `expiresAt` when present; otherwise derive from code `createdAt`. */
export function purchasedShopSetupGiftCodeEffectiveExpiresAt(args: {
  createdAt: Date;
  expiresAt?: Date | null;
}): Date {
  return args.expiresAt ?? purchasedShopSetupGiftCodeExpiresAt(args.createdAt);
}

export function isPurchasedShopSetupGiftCodeExpired(args: {
  createdAt: Date;
  expiresAt?: Date | null;
  now?: Date;
}): boolean {
  return isCreatorGiftCodeExpired(
    purchasedShopSetupGiftCodeEffectiveExpiresAt(args),
    args.now,
  );
}

export function isCreatorGiftCodeExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}

export type CreatorGiftCodeUsageStatus = "unused" | "used" | "expired";

export function creatorGiftCodeUsageStatus(args: {
  redeemedAt: Date | null | undefined;
  expiresAt: Date | null | undefined;
  now?: Date;
}): CreatorGiftCodeUsageStatus {
  if (args.redeemedAt != null) return "used";
  if (isCreatorGiftCodeExpired(args.expiresAt, args.now)) return "expired";
  return "unused";
}
