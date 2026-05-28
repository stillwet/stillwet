/** User-facing error when plain text must not contain links (e.g. shop welcome message). */
export const PLAIN_TEXT_NO_URLS_ERROR =
  "Links and web addresses are not allowed here. Use the social links section instead.";

const COMMON_TLDS =
  "com|net|org|io|co|dev|app|tv|me|xyz|info|biz|us|uk|ca|au|de|fr|es|it|nl|se|no|fi|dk|pl|cz|at|ch|be|ie|nz|jp|kr|in|br|mx|shop|store|online|site|link|live|cloud|tech|art|blog|news|media|social|gg|fm|ly|to|cc|ws|mobi|pro|name|email";

const URL_SCHEME_RE = /(?:https?|ftp|mailto|hxxps?):\/\//i;
const WWW_RE = /\bwww\.[a-z0-9][-a-z0-9.]*[a-z0-9]/i;
const SCHEME_RELATIVE_RE = /(?:^|\s)\/\/[a-z0-9][-a-z0-9.]*[a-z0-9]/i;
const MARKDOWN_LINK_RE = /\[[^\]]+\]\(\s*(?:https?:\/\/|www\.|\/\/)/i;
const DOMAIN_TLD_RE = new RegExp(
  `\\b[a-z0-9][-a-z0-9]{0,62}\\.(?:${COMMON_TLDS})\\b`,
  "i",
);

/** Collapse common obfuscation (spaces in scheme / www). */
function deobfuscatePlainTextUrls(text: string): string {
  return text
    .replace(/\bh\s*t\s*t\s*p\s*s?\s*:/gi, "http:")
    .replace(/\bw\s*w\s*w\s*\./gi, "www.");
}

/** True when `text` appears to contain a URL, domain, or markdown link. */
export function plainTextContainsUrlLike(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const normalized = deobfuscatePlainTextUrls(trimmed);
  return (
    URL_SCHEME_RE.test(normalized) ||
    WWW_RE.test(normalized) ||
    SCHEME_RELATIVE_RE.test(normalized) ||
    MARKDOWN_LINK_RE.test(normalized) ||
    DOMAIN_TLD_RE.test(normalized)
  );
}

export function plainTextNoUrlsValidationError(text: string): string | null {
  if (!text.trim()) return null;
  return plainTextContainsUrlLike(text) ? PLAIN_TEXT_NO_URLS_ERROR : null;
}
