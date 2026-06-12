import Link from "next/link";
import type { ReactNode } from "react";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ShopEmailVerifiedBroadcast } from "@/components/dashboard/ShopEmailVerifiedBroadcast";
import { prisma } from "@/lib/prisma";
import { verifyShopEmailFromRawToken } from "@/lib/shop-email-verification";
import { isPrismaMissingRelationError } from "@/lib/prisma-missing-relation";
import { rethrowNextNavigationError } from "@/lib/next-navigation-errors";
import { getShopOwnerSessionReadonly } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

function tokenFromSearchParams(sp: Record<string, string | string[] | undefined>): string {
  const tRaw = sp.t;
  return typeof tRaw === "string" ? tRaw : Array.isArray(tRaw) ? (tRaw[0] ?? "") : "";
}

function verifiedFlagFromSearchParams(sp: Record<string, string | string[] | undefined>): boolean {
  const raw = sp.verified;
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return value === "1";
}

function scheduleDashboardRevalidationAfterEmailVerify() {
  after(() => {
    try {
      revalidatePath("/dashboard");
    } catch (e) {
      console.error("[dashboard/verify-email] revalidatePath failed", e);
    }
  });
}

function verifyShell(title: string, body: ReactNode, action?: { href: string; label: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">{title}</h1>
      <div className="mt-4 text-sm text-zinc-400">{body}</div>
      {action ? (
        <Link href={action.href} className="mt-6 text-sm text-blue-400 hover:underline">
          {action.label}
        </Link>
      ) : null}
    </main>
  );
}

function emailVerifiedSuccessScreen(loggedIn: boolean, broadcast = false) {
  return (
    <>
      {broadcast ? <ShopEmailVerifiedBroadcast /> : null}
      {verifyShell(
        "Success! Email is verified",
        <p>
          {loggedIn
            ? "Your shop dashboard email is confirmed. You can return to your dashboard anytime."
            : "Your shop dashboard email is confirmed. Sign in to continue to your dashboard."}
        </p>,
        loggedIn
          ? { href: "/dashboard?dash=setup", label: "Go to dashboard" }
          : { href: "/dashboard/login", label: "Go to login" },
      )}
    </>
  );
}

async function emailVerifiedSuccessFromSessionFlag(): Promise<React.ReactNode | null> {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) {
    redirect("/dashboard/login");
  }

  const user = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { emailVerifiedAt: true },
  });

  if (!user?.emailVerifiedAt) {
    return verifyShell(
      "Email verification",
      <p>Your email is not verified yet. Open the full link from your latest verification email.</p>,
      { href: "/dashboard?dash=setup", label: "Go to dashboard" },
    );
  }

  return emailVerifiedSuccessScreen(true, false);
}

async function emailVerifiedSuccessIfSessionAlreadyVerified(): Promise<React.ReactNode | null> {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) return null;

  const user = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { emailVerifiedAt: true },
  });

  if (!user?.emailVerifiedAt) return null;
  return emailVerifiedSuccessScreen(true, false);
}

export default async function VerifyShopEmailPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const token = tokenFromSearchParams(sp);

  if (!token && verifiedFlagFromSearchParams(sp)) {
    return emailVerifiedSuccessFromSessionFlag();
  }

  if (!token) {
    return verifyShell(
      "Email verification",
      <p>
        This verification link is missing a token. Sign in to the shop dashboard and request a new verification
        email.
      </p>,
      { href: "/dashboard/login", label: "Go to login" },
    );
  }

  try {
    const result = await verifyShopEmailFromRawToken(token);

    if (result.ok) {
      if (!result.alreadyVerified) {
        scheduleDashboardRevalidationAfterEmailVerify();
      }
      const owner = await getShopOwnerSessionReadonly();
      return emailVerifiedSuccessScreen(Boolean(owner.shopUserId), !result.alreadyVerified);
    }

    const alreadyVerifiedScreen = await emailVerifiedSuccessIfSessionAlreadyVerified();
    if (alreadyVerifiedScreen) {
      return alreadyVerifiedScreen;
    }

    const reason =
      result.reason === "expired"
        ? "That verification link has expired. Sign in and use Resend verification email on the Onboarding tab."
        : result.reason === "missing"
          ? "That verification link was missing a token. Open the full link from your latest email."
          : "That verification link is invalid or was already used. Sign in and request a new verification email if needed.";

    return verifyShell("Email verification", <p>{reason}</p>, { href: "/dashboard/login", label: "Go to login" });
  } catch (e) {
    rethrowNextNavigationError(e);
    console.error("[dashboard/verify-email] unexpected failure", e);

    const alreadyVerifiedScreen = await emailVerifiedSuccessIfSessionAlreadyVerified();
    if (alreadyVerifiedScreen) {
      return alreadyVerifiedScreen;
    }

    if (isPrismaMissingRelationError(e)) {
      return verifyShell(
        "Email verification temporarily unavailable",
        <p>
          Our database is missing a required schema update on this environment. Try opening this link again after the
          site operator applies pending migrations.
        </p>,
      );
    }
    return verifyShell(
      "Email verification",
      <p>
        Something went wrong while confirming your email. Try opening the link from your email again, or sign in and
        request a new verification email.
      </p>,
      { href: "/dashboard/login", label: "Go to login" },
    );
  }
}
