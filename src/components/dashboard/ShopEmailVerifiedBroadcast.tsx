"use client";

import { useEffect } from "react";
import { broadcastShopEmailVerified } from "@/lib/shop-email-verified-broadcast";

/** Notifies other open dashboard tabs that email verification succeeded. */
export function ShopEmailVerifiedBroadcast() {
  useEffect(() => {
    broadcastShopEmailVerified();
  }, []);

  return null;
}
