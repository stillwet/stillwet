"use client";

import { useEffect } from "react";

const VIEW_SAMPLE_RATE = 0.2;
const VIEW_SAMPLE_WEIGHT = Math.round(1 / VIEW_SAMPLE_RATE);

/** Fire-and-forget PDP view for ranking the home hot carousel (one POST per tab session; survives Strict Mode remount). */
export function ProductStorefrontViewBeacon({ productSlug }: { productSlug: string }) {
  useEffect(() => {
    if (!productSlug || typeof window === "undefined") return;
    if (Math.random() >= VIEW_SAMPLE_RATE) return;
    const key = `storefrontPv:${productSlug}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void fetch("/api/product-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug, weight: VIEW_SAMPLE_WEIGHT }),
      keepalive: true,
    }).catch(() => {});
  }, [productSlug]);
  return null;
}
