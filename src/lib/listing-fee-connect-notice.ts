import { prisma } from "@/lib/prisma";

const KIND = "stripe_connect_required_listing_fees";

/** One unread notice per shop until read — avoids spamming the Notifications tab. */
export async function ensureListingFeeStripeConnectNotice(shopId: string): Promise<void> {
  const existing = await prisma.shopOwnerNotice.findFirst({
    where: { shopId, kind: KIND, readAt: null },
  });
  if (existing) return;
  await prisma.shopOwnerNotice.create({
    data: {
      shopId,
      kind: KIND,
      body:
        "Stripe Connect is not finished yet (charges and payouts). Connect on the Onboarding tab when you are ready for marketplace payouts — listing requests and shop upgrades do not require it.",
    },
  });
}
