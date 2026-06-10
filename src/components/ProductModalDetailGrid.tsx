"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PRODUCT_HERO_GALLERY_WRAP_CLASS } from "@/lib/product-image-gallery-constants";

type Props = {
  gallery: ReactNode;
  details: ReactNode;
  addToCart: ReactNode | null;
  /** Bumps gallery height sync when image list changes. */
  galleryHeightKey: string;
};

export function ProductModalDetailGrid({
  gallery,
  details,
  addToCart,
  galleryHeightKey,
}: Props) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [galleryHeightPx, setGalleryHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const node = galleryRef.current;
    if (!node) return;

    const lgQuery = window.matchMedia("(min-width: 1024px)");

    const sync = () => {
      if (!lgQuery.matches) {
        setGalleryHeightPx(null);
        return;
      }
      setGalleryHeightPx(node.getBoundingClientRect().height);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    lgQuery.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      lgQuery.removeEventListener("change", sync);
    };
  }, [galleryHeightKey]);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:grid-rows-[auto_auto] lg:items-start lg:gap-x-8 xl:gap-x-10">
      <div
        ref={galleryRef}
        className={`${PRODUCT_HERO_GALLERY_WRAP_CLASS} lg:col-start-1 lg:row-start-1`}
      >
        {gallery}
      </div>
      <div
        className={`${PRODUCT_HERO_GALLERY_WRAP_CLASS} lg:col-start-2 lg:row-start-1 min-h-0 overflow-y-auto overscroll-contain rounded-xl bg-zinc-950/92 p-4 sm:p-5`}
        style={
          galleryHeightPx != null
            ? { height: `${Math.round(galleryHeightPx)}px` }
            : undefined
        }
      >
        {details}
      </div>
      {addToCart ? (
        <div className={`${PRODUCT_HERO_GALLERY_WRAP_CLASS} lg:col-start-1 lg:row-start-2`}>
          {addToCart}
        </div>
      ) : null}
    </div>
  );
}
