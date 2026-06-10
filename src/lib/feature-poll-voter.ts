import { FeaturePollVoterKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { normalizeFeaturePollDonorEmail } from "@/lib/feature-poll-vote-eligibility";
import { getStripe } from "@/lib/stripe";
import type { FeaturePollView } from "@/lib/feature-poll-path";
import {
  establishFeaturePollDonorSession,
  getFeaturePollDonorSessionReadonly,
  getShopOwnerSessionReadonly,
} from "@/lib/session";

export type FeaturePollVoter =
  | { kind: "donor"; email: string; supportTipId?: string | null }
  | { kind: "shop"; shopId: string; displayName: string }
  | null;

async function finalizeSupportTipFromStripeSession(sessionId: string): Promise<{
  id: string;
  donorEmail: string;
} | null> {
  const tip = await prisma.supportTip.findFirst({
    where: { stripeCheckoutSessionId: sessionId },
    select: { id: true, donorEmail: true, paidAt: true, amountCents: true },
  });
  if (!tip) return null;
  if (tip.paidAt && tip.donorEmail) {
    return { id: tip.id, donorEmail: normalizeFeaturePollDonorEmail(tip.donorEmail) };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return null;
    const donorEmail =
      session.customer_details?.email?.trim().toLowerCase() ||
      session.customer_email?.trim().toLowerCase() ||
      null;
    if (!donorEmail) return null;
    const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
    const amountCents =
      typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
        ? session.amount_total
        : tip.amountCents;
    await prisma.supportTip.update({
      where: { id: tip.id },
      data: { donorEmail, paidAt, amountCents },
    });
    return { id: tip.id, donorEmail: normalizeFeaturePollDonorEmail(donorEmail) };
  } catch {
    return null;
  }
}

export async function verifyDonorFromSupportSession(
  sessionId: string,
): Promise<{ email: string; supportTipId: string } | null> {
  const id = sessionId.trim();
  if (!id) return null;

  const finalized = await finalizeSupportTipFromStripeSession(id);
  if (finalized) {
    return { email: finalized.donorEmail, supportTipId: finalized.id };
  }

  const tip = await prisma.supportTip.findFirst({
    where: {
      stripeCheckoutSessionId: id,
      paidAt: { not: null },
      amountCents: { gt: 0 },
      donorEmail: { not: null },
    },
    select: { id: true, donorEmail: true },
  });
  if (!tip?.donorEmail) return null;

  return {
    email: normalizeFeaturePollDonorEmail(tip.donorEmail),
    supportTipId: tip.id,
  };
}

export async function establishDonorVoterFromSupportSession(
  sessionId: string,
): Promise<{ email: string; supportTipId: string } | null> {
  const verified = await verifyDonorFromSupportSession(sessionId);
  if (!verified) return null;
  await establishFeaturePollDonorSession(verified.email, verified.supportTipId);
  return verified;
}

async function resolveShopVoter(): Promise<Extract<FeaturePollVoter, { kind: "shop" }> | null> {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) return null;
  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { id: true, displayName: true } } },
  });
  if (!row?.shop) return null;
  return {
    kind: "shop",
    shopId: row.shop.id,
    displayName: row.shop.displayName.trim() || "Shop",
  };
}

async function resolveDonorVoter(): Promise<Extract<FeaturePollVoter, { kind: "donor" }> | null> {
  const donorSession = await getFeaturePollDonorSessionReadonly();
  const email = donorSession.donorEmail?.trim();
  if (!email) return null;
  return {
    kind: "donor",
    email: normalizeFeaturePollDonorEmail(email),
    supportTipId: donorSession.activeSupportTipId?.trim() || null,
  };
}

export async function isShopOwnerSessionActive(): Promise<boolean> {
  const owner = await getShopOwnerSessionReadonly();
  return Boolean(owner.shopUserId);
}

export async function resolveFeaturePollVoter(view: FeaturePollView = "auto"): Promise<FeaturePollVoter> {
  if (view === "shop") {
    return resolveShopVoter();
  }
  if (view === "donor") {
    return resolveDonorVoter();
  }
  const shop = await resolveShopVoter();
  if (shop) return shop;
  return resolveDonorVoter();
}

export async function loadDonorPaidTipIds(donorEmail: string): Promise<string[]> {
  const normalized = normalizeFeaturePollDonorEmail(donorEmail);
  const tips = await prisma.supportTip.findMany({
    where: {
      donorEmail: normalized,
      paidAt: { not: null },
      amountCents: { gt: 0 },
    },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return tips.map((t) => t.id);
}

export async function loadDonorUsedTipIds(donorEmail: string): Promise<string[]> {
  const normalized = normalizeFeaturePollDonorEmail(donorEmail);
  const votes = await prisma.featurePollVote.findMany({
    where: {
      donorEmail: normalized,
      voterKind: FeaturePollVoterKind.donor,
      supportTipId: { not: null },
    },
    select: { supportTipId: true },
    distinct: ["supportTipId"],
  });
  return votes
    .map((vote) => vote.supportTipId)
    .filter((tipId): tipId is string => tipId != null);
}
