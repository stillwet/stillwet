/** PDP gallery column width caps (no centering). */
export const PRODUCT_HERO_GALLERY_MAX_WIDTH_CLASS =
  "min-w-0 w-full max-w-[min(100%,17rem)] sm:max-w-[min(100%,19rem)] md:max-w-[min(100%,21rem)] lg:max-w-[min(100%,25rem)]";

/** PDP / variant picker column: shrinks with its container; upper bound steps up with breakpoints. */
export const PRODUCT_HERO_GALLERY_WRAP_CLASS = `mx-auto ${PRODUCT_HERO_GALLERY_MAX_WIDTH_CLASS}`;
