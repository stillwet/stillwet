"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** One-time flash after listing submit; strips `listingSubmitted=1` from the URL so refresh does not replay it. */
export function ListingSubmittedFlashBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const strippedRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("listingSubmitted") !== "1") return;
    setVisible(true);
    if (strippedRef.current) return;
    strippedRef.current = true;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("listingSubmitted");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  if (!visible) return null;

  return (
    <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
      Listing submitted.
    </p>
  );
}
