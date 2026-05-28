import type Stripe from "stripe";
import type { Prisma } from "@/generated/prisma/client";
import { CreatorGiftCodeType, CreatorGiftPurchaseStatus } from "@/generated/prisma/enums";
import { generateCreatorGiftCode } from "@/lib/creator-gift-codes";
import { prisma } from "@/lib/prisma";
import { sendGiftRedemptionCodeEmail } from "@/lib/send-gift-redemption-code-email";

function paymentIntentIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return String(pi.id);
  return null;
}

function checkoutSessionEmail(session: Stripe.Checkout.Session): string {
  return (
    session.customer_details?.email ??
    session.customer_email ??
    ""
  )
    .trim()
    .toLowerCase();
}

async function createUniqueGiftCode(
  tx: Prisma.TransactionClient,
  args: {
    purchaseId: string;
    type: CreatorGiftCodeType;
    listingCreditsGranted?: number;
  },
) {
  const prefix = args.type === CreatorGiftCodeType.shop_setup ? "SETUP" : "LIST";
  for (let i = 0; i < 5; i++) {
    const code = generateCreatorGiftCode(prefix);
    try {
      return await tx.creatorGiftCode.create({
        data: {
          purchaseId: args.purchaseId,
          type: args.type,
          code: code.code,
          codeNormalized: code.codeNormalized,
          listingCreditsGranted: args.listingCreditsGranted ?? 0,
        },
        select: {
          code: true,
          type: true,
          listingCreditsGranted: true,
        },
      });
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  throw new Error("Could not generate a unique gift code.");
}

export async function fulfillCreatorGiftCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.metadata?.kind !== "creator_gift") return false;
  const purchaseId = session.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (session.payment_status !== "paid") return true;

  const paidAmountCents =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total
      : undefined;
  const paymentIntentId = paymentIntentIdFromCheckoutSession(session);

  const fulfilled = await prisma.$transaction(async (tx) => {
    const purchase = await tx.creatorGiftPurchase.findUnique({
      where: { id: purchaseId },
      include: { codes: true },
    });
    if (!purchase) return null;
    if (
      purchase.status !== CreatorGiftPurchaseStatus.pending &&
      purchase.status !== CreatorGiftPurchaseStatus.paid
    ) {
      return null;
    }
    if (paidAmountCents !== undefined && paidAmountCents !== purchase.amountCents) {
      return null;
    }
    const purchaserEmail = purchase.purchaserEmail.trim() || checkoutSessionEmail(session);
    if (!purchaserEmail) {
      console.error("[creator-gift] Stripe checkout completed without a purchaser email", {
        purchaseId: purchase.id,
        checkoutSessionId: session.id,
      });
      return null;
    }

    if (purchase.status === CreatorGiftPurchaseStatus.pending) {
      await tx.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: {
          status: CreatorGiftPurchaseStatus.paid,
          purchaserEmail,
          paidAt: new Date(),
          stripeCheckoutSessionId: session.id,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        },
      });
    } else if (purchase.purchaserEmail !== purchaserEmail) {
      await tx.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: { purchaserEmail },
      });
    }

    const codes: {
      type: CreatorGiftCodeType;
      code: string;
      listingCreditsGranted: number;
    }[] = purchase.codes.map((c) => ({
      type: c.type,
      code: c.code,
      listingCreditsGranted: c.listingCreditsGranted,
    }));
    if (
      purchase.setupFeeIncluded &&
      !codes.some((c) => c.type === CreatorGiftCodeType.shop_setup)
    ) {
      codes.push(
        await createUniqueGiftCode(tx, {
          purchaseId: purchase.id,
          type: CreatorGiftCodeType.shop_setup,
        }),
      );
    }
    if (
      purchase.listingCreditsGranted > 0 &&
      !codes.some((c) => c.type === CreatorGiftCodeType.listing_credits)
    ) {
      codes.push(
        await createUniqueGiftCode(tx, {
          purchaseId: purchase.id,
          type: CreatorGiftCodeType.listing_credits,
          listingCreditsGranted: purchase.listingCreditsGranted,
        }),
      );
    }

    return {
      purchaseId: purchase.id,
      purchaserEmail,
      emailedAt: purchase.emailedAt,
      setupCode: codes.find((c) => c.type === CreatorGiftCodeType.shop_setup)?.code ?? "Not included",
      listingCode:
        codes.find((c) => c.type === CreatorGiftCodeType.listing_credits)?.code ?? "Not included",
      listingCredits: String(purchase.listingCreditsGranted || 0),
    };
  });

  if (!fulfilled) return true;
  if (!fulfilled.emailedAt) {
    const send = await sendGiftRedemptionCodeEmail({
      toEmail: fulfilled.purchaserEmail,
      setupCode: fulfilled.setupCode,
      listingCode: fulfilled.listingCode,
      listingCredits: fulfilled.listingCredits,
    });
    if (send.ok) {
      await prisma.creatorGiftPurchase.update({
        where: { id: fulfilled.purchaseId },
        data: { emailedAt: new Date() },
      });
    } else {
      console.error("[creator-gift] email failed:", send.error);
    }
  }
  return true;
}
