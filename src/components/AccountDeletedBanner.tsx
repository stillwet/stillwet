"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Post-delete redirect banner; client-only so `/` can stay statically generated. */
export function AccountDeletedBanner() {
  const sp = useSearchParams();
  if (sp.get("accountDeleted") !== "1") return null;

  return (
    <p className="mx-auto mt-8 max-w-lg rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-center text-sm text-emerald-200/90">
      Your shop account was removed. You can create a new shop anytime from{" "}
      <Link href="/create-shop" className="text-emerald-100 underline decoration-emerald-700 underline-offset-2">
        Create shop
      </Link>
      .
    </p>
  );
}
