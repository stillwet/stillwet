export const SHOP_EMAIL_VERIFIED_BC_CHANNEL = "stillwet-shop-email-verified";
export const SHOP_EMAIL_VERIFIED_LS_KEY = "stillwet-shop-email-verified";

export function broadcastShopEmailVerified(): void {
  const payload = String(Date.now());
  try {
    localStorage.setItem(SHOP_EMAIL_VERIFIED_LS_KEY, payload);
  } catch {
    /* ignore */
  }
  try {
    const channel = new BroadcastChannel(SHOP_EMAIL_VERIFIED_BC_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* ignore */
  }
}

export function shopEmailVerifiedVerifyUrl(): string {
  return "/dashboard/verify-email?verified=1";
}
