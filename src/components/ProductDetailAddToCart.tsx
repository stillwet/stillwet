"use client";

import { ProductAddToCartForm } from "@/components/ProductAddToCartForm";

export function ProductDetailAddToCart({
  productId,
  shopSlug,
  variant,
}: {
  productId: string;
  shopSlug?: string;
  variant: "page" | "modal";
}) {
  return (
    <ProductAddToCartForm
      productId={productId}
      shopSlug={shopSlug}
      closeAfterAdd={variant === "modal"}
    />
  );
}
