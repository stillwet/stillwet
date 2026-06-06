import { isStorefrontBuyerCheckoutDisabled } from "@/lib/storefront-buyer-checkout";
import { getShippingFlatCents } from "@/lib/shipping";
import {
  estimatedTaxCents,
  parseEstimatedSalesTaxRate,
} from "@/lib/checkout-estimates";
import { buyerPaymentProcessingFeeCents } from "@/lib/stripe-card-processing-fee";
import { isStripeCheckoutAutomaticTaxEnabled } from "@/lib/stripe-checkout-tax";
import { isStripeTaxBuyerFeePassThroughEnabled } from "@/lib/stripe-tax-buyer-fee";
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
  /** When true, Payment Processing includes the Stripe Tax service pass-through. */
  paymentProcessingIncludeTaxService: boolean;
  /** When true, cart UI disables payment; {@link startCheckout} rejects on the server. */
  buyerCheckoutDisabled: boolean;
};

export async function loadCartCheckoutState(): Promise<CartCheckoutState> {
  const { rows, subtotal } = await loadActiveCartRows();
  const shippingCents = getShippingFlatCents();
  const rate = parseEstimatedSalesTaxRate();
  const taxCents = estimatedTaxCents(subtotal, rate);
  const paymentProcessingIncludeTaxService =
    isStripeCheckoutAutomaticTaxEnabled() && isStripeTaxBuyerFeePassThroughEnabled();
  const paymentProcessingCents = buyerPaymentProcessingFeeCents({
    subtotalCents: subtotal,
    shippingCents,
    tipCents: 0,
    includeTaxService: paymentProcessingIncludeTaxService,
  });
  const estimatedTotalCents =
    taxCents != null
      ? subtotal + shippingCents + taxCents + paymentProcessingCents
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
    paymentProcessingIncludeTaxService,
    buyerCheckoutDisabled: isStorefrontBuyerCheckoutDisabled(),
  };
}
