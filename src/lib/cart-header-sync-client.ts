/** Client-only: tell `StoreNav` to re-fetch `/api/header-state` after cart mutations. */
export const CART_HEADER_CHANGED_EVENT = "stillwet:cart-header-changed";

export function notifyCartHeaderChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_HEADER_CHANGED_EVENT));
}
