/** Normalized key for uniqueness: trim + lowercase (matches DB index `LOWER(TRIM("displayName"))`). */
export function shopDisplayNameUniquenessKey(displayName: string): string {
  return displayName.trim().toLowerCase();
}

/** True when the shop owner has not yet chosen and saved a display name at signup. */
export function isShopDisplayNamePending(displayName: string): boolean {
  return shopDisplayNameUniquenessKey(displayName).length === 0;
}

/** Label for UI when `displayName` is still pending (empty until first profile save). */
export function shopDisplayNameForPublicLabel(displayName: string): string {
  return isShopDisplayNamePending(displayName) ? "Your shop" : displayName.trim();
}

/** Value to show in the profile setup form (blank until the owner saves a name). */
export function shopDisplayNameForProfileForm(displayName: string): string {
  return isShopDisplayNamePending(displayName) ? "" : displayName;
}

export const SHOP_DISPLAY_NAME_TAKEN_ERROR =
  "That shop name is already taken. Choose a different name.";
