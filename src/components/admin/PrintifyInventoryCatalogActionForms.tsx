"use client";

import { resyncPrintifyCatalogProduct } from "@/actions/admin";

function CatalogResyncIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-[15px] shrink-0"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function PrintifyCatalogResyncForm({ printifyProductId }: { printifyProductId: string }) {
  return (
    <form className="inline-block" action={resyncPrintifyCatalogProduct}>
      <input type="hidden" name="printifyProductId" value={printifyProductId} />
      <button
        type="submit"
        aria-label="Resync"
        title="Resync"
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-emerald-900/60 bg-emerald-950/35 text-emerald-200/90 hover:bg-emerald-950/55"
      >
        <CatalogResyncIcon />
      </button>
    </form>
  );
}
