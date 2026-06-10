"use client";

import { useEffect, useId, useState } from "react";
import { StorePanelCloseButton } from "@/components/StorePanelCloseButton";

type AdminProductPreviewButtonProps = {
  slug: string;
  productName: string;
  /** Inactive products 404 on the storefront — preview only works when visible. */
  disabled?: boolean;
};

export function AdminProductPreviewButton({
  slug,
  productName,
  disabled = false,
}: AdminProductPreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const productPath = `/product/${encodeURIComponent(slug)}`;
  const embedPath = `/embed/product/${encodeURIComponent(slug)}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          disabled
            ? "Turn on “Visible in shop” to preview — inactive products are not served on the storefront."
            : undefined
        }
        className="shrink-0 rounded border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Preview item
      </button>
      {open ? (
        <div className="fixed inset-0 z-[5000] box-border flex items-center justify-center overscroll-contain p-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:p-4 md:p-6">
          <button
            type="button"
            aria-label="Close item details"
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-[5001] flex min-h-0 h-[calc(100dvh-1rem)] w-[calc(100dvw-1rem)] max-w-none flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:w-[calc(100dvw-2rem)] md:h-[calc(100dvh-3rem)] md:w-[calc(100dvw-3rem)]"
          >
            <StorePanelCloseButton
              onClick={() => setOpen(false)}
              aria-label="Close item details"
            />
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/90 px-3 py-2.5 pr-14 sm:px-4 sm:pr-16">
              <h2 id={titleId} className="text-sm font-medium text-zinc-200">
                Item details
              </h2>
              <a
                href={productPath}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400/90 underline-offset-2 hover:underline"
              >
                Open full page
              </a>
            </div>
            <iframe
              title={`Item details: ${productName}`}
              src={embedPath}
              className="min-h-0 w-full min-w-0 flex-1 border-0 bg-zinc-950"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
