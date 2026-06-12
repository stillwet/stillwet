import type { Metadata } from "next";
import { googleSiteVerificationMetadata } from "@/lib/google-site-verification";
import { metadataBaseUrl } from "@/lib/public-app-url";
import { BRAND_NAME } from "@/lib/site-brand";

/** Static brand mark for Open Graph / Twitter / iMessage link previews. */
export const SITE_OG_IMAGE_PATH = "/still-wet-logo-2048.png";

const SITE_TITLE = `${BRAND_NAME} — Merch`;
const SITE_DESCRIPTION = `Printed merchandise marketplace powered by ${BRAND_NAME}.`;

export function buildRootSiteMetadata(): Metadata {
  const site = metadataBaseUrl();
  const ogImage = {
    url: SITE_OG_IMAGE_PATH,
    width: 2048,
    height: 2048,
    alt: BRAND_NAME,
  };

  return {
    metadataBase: site,
    title: {
      default: SITE_TITLE,
      template: `%s · ${BRAND_NAME}`,
    },
    description: SITE_DESCRIPTION,
    alternates: {
      canonical: "/",
    },
    icons: {
      icon: [{ url: "/icon", type: "image/png" }],
      apple: [{ url: "/apple-icon", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: site.origin,
      siteName: BRAND_NAME,
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [SITE_OG_IMAGE_PATH],
    },
  };
}

/** Root metadata plus Google Search Console verification (home, gate). */
export function buildSiteMetadataWithGoogleVerification(): Metadata {
  return {
    ...buildRootSiteMetadata(),
    ...googleSiteVerificationMetadata,
  };
}
