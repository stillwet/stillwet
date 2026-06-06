"use client";

import { useEffect } from "react";
import { clearCartAfterPaidSession } from "@/actions/order";
import { notifyCartHeaderChanged } from "@/lib/cart-header-sync-client";

/** Ensures cart cookie clears after Stripe redirect (backup to server render on success page). */
export function SuccessCartClear({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    void clearCartAfterPaidSession(sessionId).then(() => notifyCartHeaderChanged());
  }, [sessionId]);

  return null;
}
