import { createHash } from "node:crypto";
import { productHref } from "@/lib/marketplace-constants";
import type { GoogleMerchantConfig } from "@/lib/google-merchant/config";
import { productImageUrls } from "@/lib/product-media";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import type { Prisma } from "@/generated/prisma/client";
import type {
  GoogleMerchantProductInput,
} from "@/lib/google-merchant/types";
import { isListingEligibleForGoogleMerchantSync } from "@/lib/google-merchant/listing-eligibility";

export type GoogleMerchantListingSource = {
  enrollmentId: string;
  shopListingId: string;
  gmcOfferId: string;
  shopSlug: string;
  shopDisplayName: string;
  shopActive: boolean;
  listing: {
    priceCents: number;
    active: boolean;
    requestStatus: import("@/generated/prisma/enums").ListingRequestStatus;
    creatorRemovedFromShopAt: Date | null;
    adminRemovedFromShopAt: Date | null;
    hiddenStorefrontForAccountDeletionAt: Date | null;
    requestItemName: string | null;
    storefrontItemBlurb: string | null;
  };
  product: {
    slug: string;
    name: string;
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  };
  /** Optional resolved storefront description (admin catalog). */
  description?: string;
};

const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function absoluteHttpsUrl(url: string, base: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    const u = t.startsWith("http") ? new URL(t) : new URL(t, base);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function listingTitle(source: GoogleMerchantListingSource): string {
  return (source.listing.requestItemName?.trim() || source.product.name.trim());
}

export function buildGoogleMerchantProductInput(
  source: GoogleMerchantListingSource,
  config: GoogleMerchantConfig,
): GoogleMerchantProductInput | { error: string } {
  const base = publicAppBaseUrl()?.replace(/\/$/, "");
  if (!base) {
    return { error: "NEXT_PUBLIC_APP_URL is not configured." };
  }

  const title = truncate(listingTitle(source), MAX_TITLE);
  if (!title) return { error: "Missing product title." };

  const description = truncate(
    source.description?.trim() ||
      source.listing.storefrontItemBlurb?.trim() ||
      `${title} — printed merchandise from ${source.shopDisplayName} on Still Wet.`,
    MAX_DESCRIPTION,
  );

  const link = `${base}${productHref(source.shopSlug, source.product.slug)}`;
  const images = productImageUrls(source.product);
  const imageLink = images.map((u) => absoluteHttpsUrl(u, base)).find(Boolean);
  if (!imageLink) return { error: "Missing HTTPS product image." };

  if (source.listing.priceCents <= 0) return { error: "Price must be greater than zero." };

  const eligible = isListingEligibleForGoogleMerchantSync(source);

  return {
    offerId: source.gmcOfferId,
    contentLanguage: config.contentLanguage,
    feedLabel: config.feedLabel,
    productAttributes: {
      title,
      description,
      link,
      imageLink,
      availability: eligible ? "IN_STOCK" : "OUT_OF_STOCK",
      condition: "NEW",
      brand: truncate(source.shopDisplayName, 70),
      identifierExists: false,
      mpn: source.gmcOfferId,
      googleProductCategory: config.defaultProductCategory,
      price: {
        amountMicros: String(source.listing.priceCents * 10_000),
        currencyCode: "USD",
      },
      shipping: [
        {
          country: config.feedLabel === "US" ? "US" : config.feedLabel,
          price: { amountMicros: "0", currencyCode: "USD" },
        },
      ],
    },
  };
}

export function hashGoogleMerchantProductInput(input: GoogleMerchantProductInput): string {
  const canonical = JSON.stringify(input);
  return createHash("sha256").update(canonical).digest("hex");
}
