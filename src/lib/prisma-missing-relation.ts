import { Prisma } from "@/generated/prisma/client";

/** True when Postgres/Prisma reports a missing table or column (migration not applied yet). */
export function isPrismaMissingRelationError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P2021" || e.code === "P2022";
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /does not exist|relation\s+"|no such table|undefined table|Unknown table/i.test(msg);
}
