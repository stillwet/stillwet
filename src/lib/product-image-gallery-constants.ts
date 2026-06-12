/** PDP gallery column — fills its grid track and scales with the panel. */
export const PRODUCT_HERO_GALLERY_COLUMN_CLASS = "pdp-gallery-col";

/** @deprecated Alias for {@link PRODUCT_HERO_GALLERY_COLUMN_CLASS}. */
export const PRODUCT_HERO_GALLERY_MAX_WIDTH_CLASS = PRODUCT_HERO_GALLERY_COLUMN_CLASS;

/** PDP / variant picker column: centered in modal layout. */
export const PRODUCT_HERO_GALLERY_WRAP_CLASS = "pdp-gallery-col pdp-gallery-col--centered";

export const PRODUCT_PDP_DETAILS_COLUMN_CLASS = "pdp-details-col";

/** Page PDP: image left (~40%), details right (~60%); add-to-cart under gallery. */
export const PRODUCT_PDP_DETAIL_GRID_CLASS = "pdp-detail-grid pdp-detail-grid--page";

export const PRODUCT_PDP_PAGE_GALLERY_CLASS = `${PRODUCT_HERO_GALLERY_COLUMN_CLASS} pdp-page-gallery`;

export const PRODUCT_PDP_PAGE_GALLERY_HERO_CLASS = "pdp-gallery-hero";

export const PRODUCT_PDP_PAGE_ADD_TO_CART_CLASS = "pdp-page-add-to-cart";

/** Modal PDP grid — gallery + add-to-cart share the left column. */
export const PRODUCT_PDP_MODAL_DETAIL_GRID_CLASS = "pdp-modal-detail-grid";

export const PRODUCT_PDP_MODAL_GALLERY_COLUMN_CLASS = `${PRODUCT_HERO_GALLERY_COLUMN_CLASS} pdp-modal-gallery-col`;

export const productPdpGalleryGridCellClass = (placement: "galleryColumn" | "details") => {
  switch (placement) {
    case "galleryColumn":
      return PRODUCT_PDP_MODAL_GALLERY_COLUMN_CLASS;
    case "details":
      return `${PRODUCT_PDP_DETAILS_COLUMN_CLASS} pdp-modal-details min-h-0 overflow-y-auto overscroll-contain rounded-xl bg-zinc-950/92 p-4 sm:p-5`;
  }
};
