import { randomBytes } from "crypto";

export const SHOP_SETUP_FEE_CENTS = 1500;
export const SHOP_SETUP_FEE_LABEL = "One-time shop setup account fee";

export function normalizeCreatorGiftCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function formatCreatorGiftCode(normalized: string): string {
  const clean = normalizeCreatorGiftCode(normalized);
  return clean.match(/.{1,4}/g)?.join("-") ?? clean;
}

export function generateCreatorGiftCode(prefix: "SETUP" | "LIST"): {
  code: string;
  codeNormalized: string;
} {
  const body = randomBytes(9).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const codeNormalized = `${prefix}${body.slice(0, 12)}`;
  return { code: formatCreatorGiftCode(codeNormalized), codeNormalized };
}
