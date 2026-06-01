import { importPKCS8, SignJWT } from "jose";
import type { GoogleMerchantConfig } from "@/lib/google-merchant/config";

const CONTENT_SCOPE = "https://www.googleapis.com/auth/content";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

async function signServiceAccountJwt(config: GoogleMerchantConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(config.serviceAccount.privateKey, "RS256");
  return new SignJWT({ scope: CONTENT_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(config.serviceAccount.clientEmail)
    .setSubject(config.serviceAccount.clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}

export async function getGoogleMerchantAccessToken(
  config: GoogleMerchantConfig,
): Promise<string> {
  const nowMs = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > nowMs + 60_000) {
    return cachedToken.accessToken;
  }

  const assertion = await signServiceAccountJwt(config);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error ?? `Google OAuth token request failed (${res.status})`);
  }

  const expiresInSec = body.expires_in ?? 3600;
  cachedToken = {
    accessToken: body.access_token,
    expiresAtMs: nowMs + expiresInSec * 1000,
  };
  return body.access_token;
}

/** Clears cached token (tests). */
export function resetGoogleMerchantAccessTokenCache(): void {
  cachedToken = null;
}
