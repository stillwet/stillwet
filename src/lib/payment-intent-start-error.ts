import { Prisma } from "@/generated/prisma/client";

/** User-facing message when creating a platform PaymentIntent + purchase row fails. */
export function paymentIntentStartErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();

  if (
    e instanceof Prisma.PrismaClientValidationError &&
    lower.includes("stripepaymentintentid")
  ) {
    return "Payment setup failed: the server is using an outdated database client. Run `npx prisma generate`, then restart the dev server.";
  }

  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2022" || e.code === "P2021")
  ) {
    return "Payment setup failed: run `npx prisma migrate deploy` on this database, then restart the server.";
  }

  if (lower.includes("stripepaymentintentid") && lower.includes("does not exist")) {
    return "Payment setup failed: run `npx prisma migrate deploy` on this database, then restart the server.";
  }

  if (lower.includes("stripe_secret_key")) {
    return "Stripe is not configured on the server.";
  }

  if (process.env.NODE_ENV === "development" && raw.trim()) {
    return raw.trim();
  }

  return "Could not start payment. Try again.";
}
