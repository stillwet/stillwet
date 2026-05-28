"use client";

import { useEffect } from "react";
import { clearCartAfterPaidSession } from "@/actions/order";

/** Ensures cart cookie clears after Stripe redirect (backup to server render on success page). */
export function SuccessCartClear({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    void clearCartAfterPaidSession(sessionId);
  }, [sessionId]);

  return null;
}
