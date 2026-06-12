"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StorePanelCloseButton } from "@/components/StorePanelCloseButton";
import { catalogImageUrlKey, uniqueImageUrlsOrdered } from "@/lib/product-media";

export { PRODUCT_HERO_GALLERY_WRAP_CLASS } from "@/lib/product-image-gallery-constants";

type Props = {
  images: string[];
  /** When this changes (e.g. selected Printify variant), move the main image to match `preferMainSrc` if it exists in `images`, else first. */
  resetKey?: string;
  /** e.g. variant mockup URL — must already be in `images` to select it; otherwise main falls back to first image. */
  preferMainSrc?: string | null;
  /** Admin catalog item reference photo — caption when shown as main image. */
  sizeReferenceImageUrl?: string | null;
};

function imageCaption(
  src: string | null | undefined,
  sizeReferenceImageUrl: string | null | undefined,
): string | null {
  if (!src) return null;
  const referenceKey = sizeReferenceImageUrl?.trim()
    ? catalogImageUrlKey(sizeReferenceImageUrl.trim())
    : "";
  if (referenceKey && catalogImageUrlKey(src) === referenceKey) {
    return "FOR SIZE REFERENCE";
  }
  return "ITEM DESIGN";
}

function isSizeReferenceImage(
  src: string,
  sizeReferenceImageUrl: string | null | undefined,
): boolean {
  const referenceKey = sizeReferenceImageUrl?.trim()
    ? catalogImageUrlKey(sizeReferenceImageUrl.trim())
    : "";
  return Boolean(referenceKey && catalogImageUrlKey(src) === referenceKey);
}

/** Storefront hero + first thumb: first gallery image that is not the size-reference photo. */
function primaryGalleryIndex(
  list: string[],
  sizeReferenceImageUrl: string | null | undefined,
): number {
  const idx = list.findIndex((src) => !isSizeReferenceImage(src, sizeReferenceImageUrl));
  return idx >= 0 ? idx : 0;
}

export function ProductImageGallery({
  images,
  sizeReferenceImageUrl,
}: Props) {
  const imagesFingerprint = useMemo(() => images.join("\u001f"), [images]);
  const list = useMemo(
    () => uniqueImageUrlsOrdered(images),
    // Fingerprint tracks image URL list identity; avoids recomputing when parent passes a new `images` array with the same contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally depend on fingerprint, not `images` reference
    [imagesFingerprint],
  );

  const primaryIndex = useMemo(
    () => primaryGalleryIndex(list, sizeReferenceImageUrl),
    [list, sizeReferenceImageUrl],
  );

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxTitleId = useId();

  useEffect(() => {
    if (lightboxIndex == null) return;
    if (lightboxIndex >= list.length) setLightboxIndex(null);
  }, [lightboxIndex, list.length]);

  const stepLightbox = useCallback(
    (delta: -1 | 1) => {
      setLightboxIndex((current) => {
        if (current == null || list.length <= 1) return current;
        return (current + delta + list.length) % list.length;
      });
    },
    [list.length],
  );

  useEffect(() => {
    if (lightboxIndex == null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxIndex, stepLightbox]);

  const primary = list[primaryIndex] ?? list[0];
  const primaryImageCaption = imageCaption(primary, sizeReferenceImageUrl);
  const mainImageCaptionClass =
    "pdp-gallery-caption mt-2 text-center font-semibold uppercase tracking-wide text-zinc-400";

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const lightboxSrc = lightboxIndex != null ? list[lightboxIndex] : null;
  const lightboxCaption =
    lightboxIndex != null ? imageCaption(lightboxSrc, sizeReferenceImageUrl) : null;
  const showLightboxNav = list.length > 1;

  return (
    <>
      <button
        type="button"
        title="View larger image"
        aria-label="View larger image"
        onClick={() => openLightbox(primaryIndex)}
        disabled={!primary}
        className="aspect-square w-full overflow-hidden rounded-2xl bg-zinc-900 disabled:cursor-default"
      >
        {primary ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primary} alt="" className="h-full w-full cursor-zoom-in object-cover" />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-zinc-600">
            No image
          </div>
        )}
      </button>
      {primaryImageCaption ? (
        <p className={mainImageCaptionClass}>{primaryImageCaption}</p>
      ) : null}
      {list.length > 1 ? (
        <ul className="pdp-gallery-thumbs">
          {list.map((src, i) => {
            const thumbSrc = i === 0 ? (primary ?? src) : src;
            const thumbSelected = i === primaryIndex;
            return (
              <li key={`${src}-${i}`}>
                <button
                  type="button"
                  title="View larger image"
                  aria-label={`View image ${i + 1} larger`}
                  aria-current={thumbSelected ? "true" : undefined}
                  onClick={() => openLightbox(i)}
                  className={`pdp-gallery-thumb-btn${
                    thumbSelected ? " pdp-gallery-thumb-btn--selected" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbSrc} alt="" className="pdp-gallery-thumb-img" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {lightboxIndex != null && lightboxSrc && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="Close image preview"
                className="fixed inset-0 bg-black/70"
                onClick={() => setLightboxIndex(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={lightboxTitleId}
                className="relative z-[61] w-full max-w-[min(92vw,720px)] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-xl sm:p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <StorePanelCloseButton
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close image preview"
                />
                <h3 id={lightboxTitleId} className="sr-only">
                  Product image preview
                </h3>
                <div className="relative flex items-center justify-center">
                  {showLightboxNav ? (
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => stepLightbox(-1)}
                      className="absolute left-0 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/90 text-xl leading-none text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 sm:-left-1"
                    >
                      ‹
                    </button>
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxSrc}
                    alt=""
                    className="mx-auto max-h-[min(75vh,640px)] w-full bg-zinc-900 object-contain px-10 sm:px-12"
                  />
                  {showLightboxNav ? (
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => stepLightbox(1)}
                      className="absolute right-0 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/90 text-xl leading-none text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 sm:-right-1"
                    >
                      ›
                    </button>
                  ) : null}
                </div>
                {lightboxCaption ? (
                  <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400 sm:text-xs">
                    {lightboxCaption}
                  </p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
