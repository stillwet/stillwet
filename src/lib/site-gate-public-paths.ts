import { SITE_OG_IMAGE_PATH } from "@/lib/site-metadata";

/** Paths that must stay reachable when SITE_ACCESS_PASSWORD is set (icons, OG assets). */
export function isSiteGatePublicAssetPath(pathname: string): boolean {
  return (
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/opengraph-image" ||
    pathname === SITE_OG_IMAGE_PATH ||
    pathname === "/still-wet-logo.svg" ||
    pathname === "/still-wet-logo-full.svg" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/apple-touch-icon-precomposed.png"
  );
}

const LINK_PREVIEW_CRAWLER_UA =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|applebot|imessagebot/i;

export function isLinkPreviewCrawlerUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return LINK_PREVIEW_CRAWLER_UA.test(userAgent);
}
