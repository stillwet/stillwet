"use client";

import { useEffect } from "react";

const VIEW_SAMPLE_RATE = 0.2;
const VIEW_SAMPLE_WEIGHT = Math.round(1 / VIEW_SAMPLE_RATE);

/** One POST per tab session when a creator storefront home loads (Strict Mode safe). */
export function ShopStorefrontViewBeacon({ shopSlug }: { shopSlug: string }) {
  useEffect(() => {
    if (!shopSlug || typeof window === "undefined") return;
    if (Math.random() >= VIEW_SAMPLE_RATE) return;
    const key = `storefrontSv:${shopSlug}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void fetch("/api/shop-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopSlug, weight: VIEW_SAMPLE_WEIGHT }),
      keepalive: true,
    }).catch(() => {});
  }, [shopSlug]);
  return null;
}
