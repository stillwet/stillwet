"use client";

import { useEffect } from "react";
import {
  SHOP_EMAIL_VERIFIED_BC_CHANNEL,
  SHOP_EMAIL_VERIFIED_LS_KEY,
  shopEmailVerifiedVerifyUrl,
} from "@/lib/shop-email-verified-broadcast";

/** When another tab completes email verification, navigate this dashboard tab to the success screen. */
export function ShopEmailVerifiedDashboardListener() {
  useEffect(() => {
    const go = () => {
      if (window.location.pathname.startsWith("/dashboard/verify-email")) return;
      window.location.assign(shopEmailVerifiedVerifyUrl());
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SHOP_EMAIL_VERIFIED_BC_CHANNEL);
      channel.onmessage = go;
    } catch {
      /* ignore */
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === SHOP_EMAIL_VERIFIED_LS_KEY) go();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
