import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { publicAppBaseUrl } from "@/lib/public-app-url";

const DEVICE_COOKIE = "stillwet_shop_device";
const CHALLENGE_TTL_MS = 15 * 60 * 1000;

/**
 * When `NODE_ENV === "development"` and `SHOP_LOCAL_2FA_BYPASS` is `1` / `true` / `yes`, shop password
 * login skips email device confirmation even if `twoFactorEmailEnabled` is on. Never active in production.
 */
export function isShopLocalTwoFactorBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const v = process.env.SHOP_LOCAL_2FA_BYPASS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function readOrIssueDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE)?.value?.trim();
  if (existing) return existing;
  const deviceId = crypto.randomUUID();
  jar.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return deviceId;
}

export async function isTrustedDevice(shopUserId: string, deviceId: string): Promise<boolean> {
  const deviceIdHash = sha256Hex(deviceId);
  const row = await prisma.shopTrustedDevice.findUnique({
    where: { shopUserId_deviceIdHash: { shopUserId, deviceIdHash } },
    select: { id: true },
  });
  if (!row) return false;
  await prisma.shopTrustedDevice.update({
    where: { shopUserId_deviceIdHash: { shopUserId, deviceIdHash } },
    data: { lastUsedAt: new Date() },
  });
  return true;
}

export async function bestEffortClientLabel(): Promise<string> {
  const h = await headers();
  const ua = h.get("user-agent")?.trim();
  if (ua) return ua.length > 160 ? `${ua.slice(0, 160)}…` : ua;
  return "a new device";
}

export async function createTwoFactorChallenge(shopUserId: string, deviceId: string): Promise<{
  rawToken: string;
  confirmUrl: string;
  expiresAt: Date;
}> {
  const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const tokenHash = sha256Hex(rawToken);
  const deviceIdHash = sha256Hex(deviceId);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await prisma.shopTwoFactorLoginChallenge.create({
    data: { shopUserId, tokenHash, deviceIdHash, expiresAt },
  });
  const base = publicAppBaseUrl()?.replace(/\/$/, "") || "http://localhost:3000";
  const confirmUrl = `${base}/confirm-device?t=${encodeURIComponent(rawToken)}`;
  return { rawToken, confirmUrl, expiresAt };
}

export async function consumeTwoFactorChallenge(rawToken: string): Promise<
  | { ok: true; shopUserId: string; deviceIdHash: string }
  | { ok: false; reason: "invalid" | "expired" | "consumed" }
> {
  const token = rawToken.trim();
  if (!token) return { ok: false, reason: "invalid" };
  const tokenHash = sha256Hex(token);
  const row = await prisma.shopTwoFactorLoginChallenge.findUnique({
    where: { tokenHash },
    select: { shopUserId: true, deviceIdHash: true, expiresAt: true, consumedAt: true },
  });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.consumedAt) return { ok: false, reason: "consumed" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  await prisma.shopTwoFactorLoginChallenge.update({
    where: { tokenHash },
    data: { consumedAt: new Date() },
  });
  return { ok: true, shopUserId: row.shopUserId, deviceIdHash: row.deviceIdHash };
}

export async function trustDeviceForUser(shopUserId: string, deviceIdHash: string) {
  await prisma.shopTrustedDevice.upsert({
    where: { shopUserId_deviceIdHash: { shopUserId, deviceIdHash } },
    update: { lastUsedAt: new Date() },
    create: { shopUserId, deviceIdHash },
  });
}

