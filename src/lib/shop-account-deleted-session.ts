import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { rethrowNextNavigationError } from "@/lib/next-navigation-errors";

/** Clears the shop-owner session and sends the browser to `/` with `accountDeleted=1`. */
export async function signOutShopOwnerAndRedirectHome(): Promise<never> {
  const session = await getShopOwnerSession();
  session.destroy();
  redirect("/?accountDeleted=1");
  throw new Error("unreachable");
}

/** When the signed-in shop user row (or its shop) is gone, sign out and redirect home. */
export async function redirectHomeIfShopOwnerSessionInvalid(
  shopUserId: string | undefined,
): Promise<void> {
  if (!shopUserId) return;

  const row = await prisma.shopUser.findUnique({
    where: { id: shopUserId },
    select: { id: true, shop: { select: { id: true } } },
  });

  if (!row || !row.shop) {
    await signOutShopOwnerAndRedirectHome();
  }
}
/** Ensures a dashboard shop-user row still exists with its shop relation loaded. */
export async function requireShopDashboardUserWithShop<
  TUser extends { shop: TShop | null },
  TShop,
>(user: TUser | null): Promise<TUser & { shop: TShop }> {
  if (!user?.shop) {
    await signOutShopOwnerAndRedirectHome();
  }
  return user as TUser & { shop: TShop };
}

/** Heuristic for load failures caused by account deletion finishing on another device/tab. */
export function isLikelyDeletedShopAccountQueryError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025" || e.code === "P2003") return true;
  }
  if (e instanceof TypeError) {
    const msg = e.message;
    return /Cannot read propert(y|ies) of null/i.test(msg);
  }
  return false;
}

/**
 * After a dashboard data load error, prefer redirecting home when the account was deleted elsewhere
 * instead of showing the generic Postgres troubleshooting UI.
 */
export async function tryRedirectHomeOnDeletedShopAccountLoadError(
  e: unknown,
  shopUserId: string | undefined,
): Promise<void> {
  rethrowNextNavigationError(e);
  await redirectHomeIfShopOwnerSessionInvalid(shopUserId);
  if (isLikelyDeletedShopAccountQueryError(e)) {
    await signOutShopOwnerAndRedirectHome();
  }
}
