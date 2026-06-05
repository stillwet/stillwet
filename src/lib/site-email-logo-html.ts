import fs from "node:fs";
import path from "node:path";
import { BRAND_LOGO_MARK, BRAND_MERCH_NAME } from "@/lib/site-brand";
import {
  SITE_EMAIL_BRAND_HEADER_MARKER,
  SITE_EMAIL_LOGO_PLACEHOLDER,
} from "@/lib/site-email-logo-constants";
import { siteEmailLogoOutboundUrl } from "@/lib/site-email-logo-url";

const SITE_EMAIL_LOGO_FILENAME = "still-wet-logo-2048.png";

/** Home hero wordmark: uppercase, wide tracking, blue-400/80, Source Sans (regular weight). */
const SITE_EMAIL_WORDMARK_STYLE =
  "font-family:'Source Sans 3','Source Sans Pro',Arial,Helvetica,sans-serif;font-size:20px;font-weight:400;text-transform:uppercase;letter-spacing:0.2em;color:#60a5fa;line-height:1;";

let cachedAdminPreviewLogoDataUri: string | null = null;

export function siteEmailLogoAbsoluteUrl(origin?: string): string {
  return siteEmailLogoOutboundUrl(origin);
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildSiteEmailLogoHeaderHtml(logoUrl: string): string {
  const src = escapeHtmlAttr(logoUrl);
  const alt = escapeHtmlAttr(BRAND_MERCH_NAME);
  const wordmark = escapeHtmlAttr(BRAND_LOGO_MARK);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 16px;border-collapse:collapse;" ${SITE_EMAIL_BRAND_HEADER_MARKER}>
  <tr>
    <td align="left" style="padding:0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="left" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;line-height:0;">
            <img src="${src}" alt="${alt}" width="48" height="48" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="${SITE_EMAIL_WORDMARK_STYLE}">${wordmark}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Embedded PNG for admin iframe previews (`srcDoc` cannot load `/public` relative URLs). */
export function siteEmailLogoDataUriForAdminPreview(): string {
  if (cachedAdminPreviewLogoDataUri) return cachedAdminPreviewLogoDataUri;
  try {
    const filePath = path.join(process.cwd(), "public", SITE_EMAIL_LOGO_FILENAME);
    const buf = fs.readFileSync(filePath);
    cachedAdminPreviewLogoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedAdminPreviewLogoDataUri;
  } catch (e) {
    console.error("[site-email-logo] admin preview logo read failed", e);
    return siteEmailLogoAbsoluteUrl();
  }
}

function injectLogoBlock(html: string, block: string): string {
  const innerCard = html.match(/<table[^>]*max-width:\s*5\d\dpx[^>]*>[\s\S]*?<tr>\s*<td\b[^>]*>/i);
  if (innerCard?.index != null) {
    const insertAt = innerCard.index + innerCard[0].length;
    return html.slice(0, insertAt) + block + html.slice(insertAt);
  }

  const first = html.indexOf("<tr><td>");
  if (first >= 0) {
    const second = html.indexOf("<tr><td>", first + 1);
    if (second >= 0) {
      const insertAt = second + "<tr><td>".length;
      return html.slice(0, insertAt) + block + html.slice(insertAt);
    }
  }

  const body = /<body\b[^>]*>/i.exec(html);
  if (body?.index != null) {
    const insertAt = body.index + body[0].length;
    return html.slice(0, insertAt) + block + html.slice(insertAt);
  }

  return block + html;
}

function replaceLegacyLogoOnlyHeader(html: string, block: string): string {
  const legacy = html.match(
    /<p style="margin:0 0 16px;text-align:center;line-height:0;">\s*<img[^>]+(?:still-wet-logo-2048\.png|data:image\/png;base64,[^"]+)[^>]*>\s*<\/p>/i,
  );
  if (legacy?.index == null) return html;
  return html.slice(0, legacy.index) + block + html.slice(legacy.index + legacy[0].length);
}

function emailHtmlHasBrandHeader(html: string): boolean {
  return html.includes(SITE_EMAIL_BRAND_HEADER_MARKER);
}

function emailHtmlHasLogoImage(html: string): boolean {
  return html.includes("still-wet-logo-2048.png") || html.includes("data:image/png;base64,");
}

function replaceBrandHeaderBlock(html: string, logoUrl: string): string {
  const markerIdx = html.indexOf(SITE_EMAIL_BRAND_HEADER_MARKER);
  if (markerIdx < 0) return html;
  const openIdx = html.lastIndexOf("<table", markerIdx);
  if (openIdx < 0) return html;

  const openEnd = html.indexOf(">", openIdx);
  if (openEnd < 0) return html;

  let depth = 1;
  let pos = openEnd + 1;
  while (pos < html.length) {
    const nextOpen = html.indexOf("<table", pos);
    const nextClose = html.indexOf("</table>", pos);
    if (nextClose < 0) return html;

    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      const innerOpenEnd = html.indexOf(">", nextOpen);
      if (innerOpenEnd < 0) return html;
      pos = innerOpenEnd + 1;
      continue;
    }

    depth -= 1;
    pos = nextClose + "</table>".length;
    if (depth === 0) {
      return html.slice(0, openIdx) + buildSiteEmailLogoHeaderHtml(logoUrl) + html.slice(pos);
    }
  }

  return html;
}

function replaceBrandHeaderLogoSrc(html: string, logoUrl: string): string {
  return replaceBrandHeaderBlock(html, logoUrl);
}

export type SiteEmailLogoOptions = {
  origin?: string;
  logoUrl?: string;
};

function resolveLogoUrl(options?: SiteEmailLogoOptions): string {
  if (options?.logoUrl) return options.logoUrl;
  return siteEmailLogoOutboundUrl(options?.origin);
}

/** Resolves `{{EMAIL_LOGO}}` or inserts the brand mark at the top of the inner card. */
export function applySiteEmailLogoToHtml(html: string, options?: SiteEmailLogoOptions): string {
  const logoUrl = resolveLogoUrl(options);
  const block = buildSiteEmailLogoHeaderHtml(logoUrl);
  if (html.includes(SITE_EMAIL_LOGO_PLACEHOLDER)) {
    return html.split(SITE_EMAIL_LOGO_PLACEHOLDER).join(block);
  }
  if (emailHtmlHasBrandHeader(html)) {
    return replaceBrandHeaderLogoSrc(html, logoUrl);
  }
  if (emailHtmlHasLogoImage(html)) {
    return replaceLegacyLogoOnlyHeader(html, block);
  }
  return injectLogoBlock(html, block);
}

/** Admin preview iframes: inline logo so `srcDoc` previews always render it. */
export function normalizeEmailLogoForAdminPreview(html: string): string {
  const dataUri = siteEmailLogoDataUriForAdminPreview();
  if (html.includes(SITE_EMAIL_LOGO_PLACEHOLDER)) {
    return applySiteEmailLogoToHtml(html, { logoUrl: dataUri });
  }
  if (emailHtmlHasBrandHeader(html)) {
    return replaceBrandHeaderLogoSrc(html, dataUri);
  }
  if (emailHtmlHasLogoImage(html)) {
    return replaceLegacyLogoOnlyHeader(
      html.replace(
        /(<img[^>]+src=")[^"]*(?:still-wet-logo-2048\.png|data:image\/png;base64,[^"]*)(")/i,
        `$1${escapeHtmlAttr(dataUri)}$2`,
      ),
      buildSiteEmailLogoHeaderHtml(dataUri),
    );
  }
  return applySiteEmailLogoToHtml(html, { logoUrl: dataUri });
}
