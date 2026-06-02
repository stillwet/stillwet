import Link from "next/link";
import { verifyShopEmailFromRawToken } from "@/lib/shop-email-verification";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

function tokenFromSearchParams(sp: Record<string, string | string[] | undefined>): string {
  const tRaw = sp.t;
  return typeof tRaw === "string" ? tRaw : Array.isArray(tRaw) ? (tRaw[0] ?? "") : "";
}

export default async function VerifyShopEmailPage({ searchParams }: PageProps) {
  const token = tokenFromSearchParams(await searchParams);

  if (!token) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col px-4 py-16">
        <h1 className="text-xl font-semibold text-zinc-50">Email verification</h1>
        <p className="mt-4 text-sm text-zinc-400">
          This verification link is missing a token. Sign in to the shop dashboard and request a new verification
          email.
        </p>
        <Link href="/dashboard/login" className="mt-6 text-sm text-blue-400 hover:underline">
          Go to login
        </Link>
      </main>
    );
  }

  const result = await verifyShopEmailFromRawToken(token);

  if (result.ok) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col px-4 py-16">
        <h1 className="text-xl font-semibold text-zinc-50">Success! Email is verified</h1>
        <p className="mt-4 text-sm text-zinc-400">
          Your shop dashboard email is confirmed. You can close this tab or continue to your dashboard.
        </p>
        <Link href="/dashboard/login" className="mt-6 text-sm text-blue-400 hover:underline">
          Go to dashboard
        </Link>
      </main>
    );
  }

  const reason =
    result.reason === "expired"
      ? "That verification link has expired. Sign in and use Resend verification email on the Onboarding tab."
      : result.reason === "missing"
        ? "That verification link was missing a token. Open the full link from your latest email."
        : "That verification link is invalid or was already used. Sign in and request a new verification email if needed.";

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Email verification</h1>
      <p className="mt-4 text-sm text-zinc-400">{reason}</p>
      <Link href="/dashboard/login" className="mt-6 text-sm text-blue-400 hover:underline">
        Go to login
      </Link>
    </main>
  );
}
