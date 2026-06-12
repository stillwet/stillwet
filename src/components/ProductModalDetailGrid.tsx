"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  PRODUCT_PDP_MODAL_DETAIL_GRID_CLASS,
  PRODUCT_PDP_PAGE_ADD_TO_CART_CLASS,
  PRODUCT_PDP_PAGE_GALLERY_HERO_CLASS,
  productPdpGalleryGridCellClass,
} from "@/lib/product-image-gallery-constants";

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

    const sync = () => {
      setGalleryHeightPx(node.getBoundingClientRect().height);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [galleryHeightKey]);

  return (
    <div className={PRODUCT_PDP_MODAL_DETAIL_GRID_CLASS}>
      <div className={productPdpGalleryGridCellClass("galleryColumn")}>
        <div ref={galleryRef} className={PRODUCT_PDP_PAGE_GALLERY_HERO_CLASS}>
          {gallery}
        </div>
        {addToCart ? (
          <div className={PRODUCT_PDP_PAGE_ADD_TO_CART_CLASS}>{addToCart}</div>
        ) : null}
      </div>
      <div
        className={productPdpGalleryGridCellClass("details")}
        style={
          galleryHeightPx != null
            ? { height: `${Math.round(galleryHeightPx)}px` }
            : undefined
        }
      >
        {details}
      </div>
    </div>
  );
}
