import type { Metadata } from "next";

/** Google Merchant / Search Console HTML meta tag token (public, not secret). */
export const GOOGLE_SITE_VERIFICATION_TOKEN = "jQ-hWemO5msKmQ0AmE49gCt4O0mdyx6lxKv3YzfMU0M";

export const googleSiteVerificationMetadata: Metadata = {
  verification: {
    google: GOOGLE_SITE_VERIFICATION_TOKEN,
  },
};
