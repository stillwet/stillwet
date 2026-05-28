import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { readOrIssueDeviceId, sha256Hex } from "@/lib/shop-two-factor";

export async function GET() {
  const session = await getShopOwnerSession();
  const pendingUserId = session.pendingTwoFactorShopUserId?.trim() || "";
  if (!pendingUserId) {
    return NextResponse.json({ ok: true, pending: false, trusted: false });
  }

  const deviceId = await readOrIssueDeviceId();
  const deviceIdHash = sha256Hex(deviceId);

  const trusted = await prisma.shopTrustedDevice.findUnique({
    where: { shopUserId_deviceIdHash: { shopUserId: pendingUserId, deviceIdHash } },
    select: { id: true },
  });

  if (!trusted) {
    return NextResponse.json({ ok: true, pending: true, trusted: false });
  }

  session.shopUserId = pendingUserId;
  delete session.pendingTwoFactorShopUserId;
  await session.save();

  return NextResponse.json({ ok: true, pending: false, trusted: true });
}

