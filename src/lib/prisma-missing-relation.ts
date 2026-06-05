import { Prisma } from "@/generated/prisma/client";

/** True when Postgres/Prisma reports a missing table or column (migration not applied yet). */
export function isPrismaMissingRelationError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P2021" || e.code === "P2022";
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /does not exist|relation\s+"|no such table|undefined table|Unknown table/i.test(msg);
}

/** User-facing hint when dashboard tab API hits Prisma schema/client drift. */
export function dashboardTabPrismaErrorMessage(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientValidationError) {
    return "Dashboard is using an outdated Prisma client. Run `npx prisma generate`, restart `npm run dev`, or delete `.next` and try again.";
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
    const column = String((e.meta as { column?: string } | undefined)?.column ?? "");
    if (/listingPrintifyVariantPrices|printifyVariants/i.test(column)) {
      return "Dashboard is using a stale Prisma client after a recent schema change. Run `npx prisma generate`, restart `npm run dev`, or delete `.next` and try again.";
    }
    return "Database schema mismatch. Run `npx prisma migrate deploy`, then `npx prisma generate`, and restart the dev server.";
  }
  if (isPrismaMissingRelationError(e)) {
    return "Database schema mismatch. Run `npx prisma migrate deploy`, then `npx prisma generate`, and restart the dev server.";
  }
  return null;
}
