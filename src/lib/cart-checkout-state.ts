import { isStorefrontBuyerCheckoutDisabled } from "@/lib/storefront-buyer-checkout";
import { getShippingFlatCents } from "@/lib/shipping";
import {
  estimatedTaxCents,
  parseEstimatedSalesTaxRate,
} from "@/lib/checkout-estimates";
import {
  buyerStripeTaxServiceFeeCents,
  isStripeTaxBuyerFeePassThroughEnabled,
} from "@/lib/stripe-tax-buyer-fee";
import { cartRowProductHref, loadActiveCartRows } from "@/lib/cart-rows-active";

export type CartCheckoutLine = {
  listingId: string;
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  lineCents: number;
  unitCents: number;
  variantSub: string | null;
  primaryTagName: string | null;
  fulfillmentType: string;
  productHref: string;
};

export type CartCheckoutState = {
  lines: CartCheckoutLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number | null;
  estimatedTotalCents: number | null;
  estimatedSalesTaxRate: number | null;
  /** When true, cart shows a 0.5% sales tax processing line (Stripe Tax pass-through). */
  stripeTaxBuyerFeeEnabled: boolean;
  /** When true, cart UI disables payment; {@link startCheckout} rejects on the server. */
  buyerCheckoutDisabled: boolean;
};

export async function loadCartCheckoutState(): Promise<CartCheckoutState> {
  const { rows, subtotal } = await loadActiveCartRows();
  const shippingCents = getShippingFlatCents();
  const rate = parseEstimatedSalesTaxRate();
  const taxCents = estimatedTaxCents(subtotal, rate);
  const stripeTaxBuyerFeeEnabled = isStripeTaxBuyerFeePassThroughEnabled();
  const stripeTaxServiceFeeCents = buyerStripeTaxServiceFeeCents({
    subtotalCents: subtotal,
    shippingCents,
    tipCents: 0,
  });
  const estimatedTotalCents =
    taxCents != null
      ? subtotal + shippingCents + taxCents + stripeTaxServiceFeeCents
      : null;
  return {
    lines: rows.map((r) => ({
      listingId: r.listingId,
      productId: r.product.id,
      slug: r.product.slug,
      name: r.lineDisplayName,
      quantity: r.quantity,
      lineCents: r.line,
      unitCents: r.unit,
      variantSub: r.variantSub,
      primaryTagName: r.product.primaryTag?.name ?? null,
      fulfillmentType: r.product.fulfillmentType,
      productHref: cartRowProductHref(r),
    })),
    subtotalCents: subtotal,
    shippingCents,
    taxCents,
    estimatedTotalCents,
    estimatedSalesTaxRate: rate,
    stripeTaxBuyerFeeEnabled,
    buyerCheckoutDisabled: isStorefrontBuyerCheckoutDisabled(),
  };
}
