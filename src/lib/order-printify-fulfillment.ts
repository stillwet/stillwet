import { prisma } from "@/lib/prisma";
import { BRAND_NAME } from "@/lib/site-brand";
import { coercePrintifyOrderVariantId, createPrintifyOrder } from "@/lib/printify";
import { FulfillmentType, FulfillmentJobStatus, OrderStatus } from "@/generated/prisma/enums";

function splitName(full: string | null | undefined): { first: string; last: string } {
  if (!full?.trim()) return { first: "Customer", last: "." };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "." };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Creates a Printify order for a paid merch checkout. Safe to run after the Stripe webhook returns
 * (idempotent via existing fulfillment job rows).
 */
export async function fulfillPaidOrderPrintify(orderId: string): Promise<void> {
  const paid = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true, fulfillmentJobs: true },
  });
  if (!paid || paid.status !== OrderStatus.paid) return;

  const hasPrintifyJob = paid.fulfillmentJobs.some((j) => j.provider === "printify");
  if (hasPrintifyJob) return;

  const orderWantsPrintify = paid.lines.some((l) => l.fulfillmentType === FulfillmentType.printify);
  if (!orderWantsPrintify) return;

  const printifyLines = paid.lines.filter(
    (l) =>
      l.fulfillmentType === FulfillmentType.printify &&
      l.printifyProductId &&
      l.printifyVariantId,
  );

  if (printifyLines.length === 0) {
    await prisma.fulfillmentJob.create({
      data: {
        orderId: paid.id,
        provider: "printify",
        status: FulfillmentJobStatus.failed,
        lastError:
          "Printify line items missing product/variant IDs — set printifyProductId and printifyVariantId on products.",
        attempts: 1,
      },
    });
    return;
  }

  const variantItems = printifyLines
    .map((l) => {
      const vidRaw = l.printifyVariantId!.trim();
      if (!vidRaw) return null;
      const variant_id = coercePrintifyOrderVariantId(vidRaw);
      if (variant_id === "") return null;
      return {
        product_id: l.printifyProductId!,
        variant_id,
        quantity: l.quantity,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (variantItems.length === 0) {
    await prisma.fulfillmentJob.create({
      data: {
        orderId: paid.id,
        provider: "printify",
        status: FulfillmentJobStatus.failed,
        lastError: "Invalid Printify variant ids on order lines.",
        attempts: 1,
      },
    });
    return;
  }

  const { first: firstName, last: lastName } = splitName(paid.shippingName);
  const email = paid.email ?? "customer@example.com";
  const phone = paid.shippingPhone ?? "";

  const job = await prisma.fulfillmentJob.create({
    data: {
      orderId: paid.id,
      provider: "printify",
      status: FulfillmentJobStatus.processing,
      attempts: 1,
    },
  });

  try {
    const { id: externalId, raw } = await createPrintifyOrder({
      externalId: paid.id,
      label: `${BRAND_NAME} ${paid.id.slice(0, 8)}`,
      lineItems: variantItems,
      addressTo: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || "0000000000",
        country: paid.shippingCountry ?? "US",
        region: paid.shippingState ?? "",
        address1: paid.shippingLine1 ?? "",
        address2: paid.shippingLine2 ?? undefined,
        city: paid.shippingCity ?? "",
        zip: paid.shippingPostal ?? "",
      },
    });

    await prisma.fulfillmentJob.update({
      where: { id: job.id },
      data: {
        status: FulfillmentJobStatus.succeeded,
        externalId,
        payload: raw as object,
        lastError: null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[order-printify-fulfillment] Printify error:", msg);
    await prisma.fulfillmentJob.update({
      where: { id: job.id },
      data: {
        status: FulfillmentJobStatus.failed,
        lastError: msg,
      },
    });
  }
}
