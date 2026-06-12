import Link from "next/link";
import type { ReactNode } from "react";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { completeVerifiedShopAccountDeletion } from "@/lib/complete-verified-shop-account-deletion";
import { isPrismaMissingRelationError } from "@/lib/prisma-missing-relation";
import { confirmShopAccountDeletionFromRawToken } from "@/lib/shop-account-deletion";
import {
  applyVerifiedAccountDeletionListingAndMediaCleanup,
  purgeShopUploadedMediaFromR2,
} from "@/lib/shop-account-deletion-request-effects";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

function tokenFromSearchParams(sp: Record<string, string | string[] | undefined>): string {
  const tRaw = sp.t;
  return typeof tRaw === "string" ? tRaw : Array.isArray(tRaw) ? (tRaw[0] ?? "") : "";
}

function previewSuccessFromSearchParams(sp: Record<string, string | string[] | undefined>): boolean {
  const raw = sp.preview;
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return value === "success";
}

function accountDeletionConfirmedPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Account Deletion Confirmed</h1>
    </main>
  );
}

function confirmErrorShell(title: string, body: ReactNode, homeHref = "/", homeLabel = "Return home") {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">{title}</h1>
      <div className="mt-4 text-sm text-zinc-400">{body}</div>
      <Link href={homeHref} className="mt-6 text-sm text-blue-400 hover:underline">
        {homeLabel}
      </Link>
    </main>
  );
}

function scheduleAccountDeletionCacheRevalidation(shopSlug: string | undefined) {
  after(() => {
    try {
      revalidatePath("/dashboard");
      revalidatePath("/shops");
      if (shopSlug?.trim()) {
        revalidatePath(`/s/${shopSlug.trim()}`);
      }
    } catch (e) {
      console.error("[account-deletion/confirm] revalidatePath failed", e);
    }
  });
}

export default async function AccountDeletionConfirmPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const token = tokenFromSearchParams(sp);

  if (
    previewSuccessFromSearchParams(sp) &&
    (process.env.NODE_ENV === "development" || process.env.ALLOW_EMAIL_PREVIEW === "1")
  ) {
    return accountDeletionConfirmedPage();
  }

  if (!token) {
    return confirmErrorShell(
      "Account deletion",
      <p>
        This confirmation link is missing a token. Open the full link from your latest email, or sign in and request
        deletion again from the Shop profile tab.
      </p>,
      "/dashboard/login",
      "Go to dashboard login",
    );
  }

  try {
    const result = await confirmShopAccountDeletionFromRawToken(token);

    if (!result.ok) {
      const reason =
        result.reason === "expired"
          ? "That account deletion link has expired. Sign in and request deletion again from the Shop profile tab to receive a new email."
          : result.reason === "missing"
            ? "That account deletion link was missing a token. Open the full link from your latest email."
            : "That account deletion link is invalid or was already used. Use the newest email we sent, or sign in and tap Resend email on the Shop profile tab.";

      return confirmErrorShell("Account deletion", <p>{reason}</p>, "/dashboard/login", "Go to dashboard login");
    }

    const shopBeforeCleanup = await prisma.shop.findUnique({
      where: { id: result.shopId },
      select: { slug: true },
    });

    if (!result.alreadyConfirmed) {
      try {
        await purgeShopUploadedMediaFromR2(result.shopId);
        await applyVerifiedAccountDeletionListingAndMediaCleanup(result.shopId);
      } catch (e) {
        console.error("[account-deletion/confirm] purge/cleanup after email verify", e);
      }
    }

    const shopSlug = shopBeforeCleanup?.slug;
    scheduleAccountDeletionCacheRevalidation(shopSlug);

    const completion = await completeVerifiedShopAccountDeletion(result.shopId);
    if (completion.ok && completion.deleted) {
      scheduleAccountDeletionCacheRevalidation(completion.shopSlug);
    }

    return accountDeletionConfirmedPage();
  } catch (e) {
    console.error("[account-deletion/confirm] unexpected failure", e);
    if (isPrismaMissingRelationError(e)) {
      return confirmErrorShell(
        "Account deletion temporarily unavailable",
        <p>
          Our database is missing a required schema update on this environment. The site operator needs to run
          production migrations, then you can open this email link again.
        </p>,
      );
    }
    return confirmErrorShell(
      "Account deletion",
      <p>Something went wrong while confirming deletion. Try opening the link from your email again, or contact support.</p>,
    );
  }
}
