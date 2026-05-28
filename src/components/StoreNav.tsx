"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartDrawer } from "@/components/CartDrawer";
import { PLATFORM_SHOP_SLUG, shopAllProductsHref, shopCartHref } from "@/lib/marketplace-constants";
import { BrandLogoLink } from "@/components/BrandLogoLink";

type HeaderState = {
  cartQty: number;
  shopOwnerEmail?: string;
  shopOwnerDisplayName?: string;
};

function dashboardLinkFallbackFromEmail(email: string) {
  const i = email.indexOf("@");
  return i > 0 ? email.slice(0, i) : email;
}

export function StoreNav({
  cartQty: initialCartQty,
  shopSlug,
  shopOwnerEmail: initialShopOwnerEmail,
  shopOwnerDisplayName: initialShopOwnerDisplayName,
  hydrateHeaderState = true,
}: {
  cartQty: number;
  /** When omitted, use legacy platform URLs (`/shop/...`). */
  shopSlug?: string;
  /** Shop owner session email; when set, replaces “Log In” on platform. */
  shopOwnerEmail?: string;
  /** Shop display name for the dashboard link (preferred over email local-part). */
  shopOwnerDisplayName?: string;
  /** Fetch cart/account state after paint; keeps public server routes static. */
  hydrateHeaderState?: boolean;
}) {
  const [cartOpen, setCartOpen] = useState(false);
  const [headerState, setHeaderState] = useState<HeaderState>({
    cartQty: initialCartQty,
    shopOwnerEmail: initialShopOwnerEmail,
    shopOwnerDisplayName: initialShopOwnerDisplayName,
  });
  const tenant = shopSlug && shopSlug !== PLATFORM_SHOP_SLUG;
  const allItemsHref = shopAllProductsHref(shopSlug ?? PLATFORM_SHOP_SLUG);
  const fullCartHref = shopCartHref(shopSlug ?? PLATFORM_SHOP_SLUG);
  const { cartQty, shopOwnerEmail, shopOwnerDisplayName } = headerState;

  useEffect(() => {
    if (!hydrateHeaderState) return;
    let alive = true;
    void fetch("/api/header-state", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HeaderState | null) => {
        if (!alive || !data) return;
        setHeaderState({
          cartQty: Number.isFinite(data.cartQty) ? Math.max(0, Math.floor(data.cartQty)) : 0,
          shopOwnerEmail:
            typeof data.shopOwnerEmail === "string" ? data.shopOwnerEmail : undefined,
          shopOwnerDisplayName:
            typeof data.shopOwnerDisplayName === "string"
              ? data.shopOwnerDisplayName
              : undefined,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [hydrateHeaderState]);

  return (
    <>
      <header className="relative z-[1000] border-b border-zinc-800/40 bg-zinc-950/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1124px] items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 shrink-0 items-center gap-4 sm:gap-5">
            <BrandLogoLink logoHeight={24} />
            {shopOwnerEmail ? (
              <a
                href="/dashboard"
                className="min-w-0 max-w-[11rem] truncate text-xs font-medium tracking-wide text-zinc-400 transition hover:text-white sm:max-w-[14rem]"
                title={
                  shopOwnerDisplayName
                    ? `${shopOwnerDisplayName} (${shopOwnerEmail})`
                    : shopOwnerEmail
                }
              >
                {shopOwnerDisplayName ?? dashboardLinkFallbackFromEmail(shopOwnerEmail)}
              </a>
            ) : !tenant ? (
              <a
                href="/dashboard/login"
                className="shrink-0 text-xs font-medium tracking-wide text-zinc-400 transition hover:text-white"
              >
                Log In
              </a>
            ) : null}
          </div>
          <nav className="flex flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-2 sm:gap-x-7">
            <a
              href="/demo-instructions"
              className="store-nav-link text-zinc-400 transition hover:text-white"
            >
              Tester Instructions
            </a>
            <a
              href={allItemsHref}
              className="store-nav-link text-zinc-400 transition hover:text-white"
            >
              Items
            </a>
            <a
              href="/shops"
              className="store-nav-link text-zinc-400 transition hover:text-white"
            >
              Shops
            </a>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="store-nav-link inline-flex items-center gap-1.5 text-zinc-400 transition hover:text-white"
            >
              Cart
              {cartQty > 0 ? (
                <span
                  className="min-w-[1.25rem] rounded-full bg-blue-900/90 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-blue-100 tabular-nums"
                  aria-label={`${cartQty} items in cart`}
                >
                  {cartQty > 99 ? "99+" : cartQty}
                </span>
              ) : null}
            </button>
          </nav>
        </div>
      </header>
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        fullCartHref={fullCartHref}
      />
    </>
  );
}
