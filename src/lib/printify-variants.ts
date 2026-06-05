import { FulfillmentType } from "@/generated/prisma/enums";
import type { CartLine } from "@/lib/session";

/** Placeholder Printify variant id for listing stubs before admin wires real ids. */
export const STUB_PRINTIFY_VARIANT_ID = "__stub_printify_variant__";

export function isStubPrintifyVariantId(id: string | null | undefined): boolean {
  return id?.trim() === STUB_PRINTIFY_VARIANT_ID;
}

/** Single Printify variant id for cart/checkout/fulfillment (listing → product → stub). */
export function listingCheckoutPrintifyVariantId(
  listing: { listingPrintifyVariantId?: string | null },
  product: {
    fulfillmentType: FulfillmentType;
    printifyVariantId: string | null;
  },
  cartLine?: CartLine,
): string | null {
  if (product.fulfillmentType !== FulfillmentType.printify) return null;
  const candidates = [
    cartLine?.printifyVariantId?.trim(),
    listing.listingPrintifyVariantId?.trim(),
    product.printifyVariantId?.trim(),
    STUB_PRINTIFY_VARIANT_ID,
  ].filter((id): id is string => Boolean(id));
  return candidates[0] ?? null;
}
