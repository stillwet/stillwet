"use client";

import { useEffect } from "react";
import type { CartCheckoutState } from "@/lib/cart-checkout-state";
import { CartAndCheckoutClient } from "@/components/CartAndCheckoutClient";
import { StorePanelCloseButton } from "@/components/StorePanelCloseButton";

const DRAWER_SEED: CartCheckoutState = {
  lines: [],
  subtotalCents: 0,
  shippingCents: 0,
  taxCents: null,
  estimatedTotalCents: null,
  estimatedSalesTaxRate: null,
  paymentProcessingIncludeTaxService: false,
  buyerCheckoutDisabled: false,
};

export function CartDrawer({
  open,
  onClose,
  fullCartHref = "/cart",
}: {
  open: boolean;
  onClose: () => void;
  /** Full-page cart URL (platform `/cart` or tenant `/s/:slug/cart`). */
  fullCartHref?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close cart"
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="store-dimension-panel animate-store-panel-in relative z-[2001] my-8 w-full max-w-xl shadow-2xl sm:my-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <StorePanelCloseButton onClick={onClose} aria-label="Close cart" />
        <div className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/95 px-6 py-4 pr-14 backdrop-blur-md">
          <h2
            id="cart-drawer-title"
            className="text-lg font-semibold tracking-tight text-zinc-50"
          >
            Cart &amp; Checkout
          </h2>
        </div>
        <CartAndCheckoutClient
          mode="drawer"
          initialState={DRAWER_SEED}
          open={open}
          onClose={onClose}
          fullCartHref={fullCartHref}
        />
      </div>
    </div>
  );
}
