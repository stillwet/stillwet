import Link from "next/link";
import { consumeTwoFactorChallenge, trustDeviceForUser } from "@/lib/shop-two-factor";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

function confirmDeviceSuccessPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Success! This device is verified</h1>
      <p className="mt-4 text-sm text-zinc-400">
        Return to the device you’re signing in on. It should finish logging in automatically.
      </p>
      <Link href="/dashboard/login" className="mt-6 text-sm text-blue-400 hover:underline">
        Go to login
      </Link>
    </main>
  );
}

export default async function PublicConfirmDevicePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const previewRaw = sp.preview;
  const preview = typeof previewRaw === "string" ? previewRaw : Array.isArray(previewRaw) ? previewRaw[0] : undefined;

  if (
    preview === "success" &&
    (process.env.NODE_ENV === "development" || process.env.ALLOW_EMAIL_PREVIEW === "1")
  ) {
    return confirmDeviceSuccessPage();
  }

  const tRaw = sp.t;
  const token = typeof tRaw === "string" ? tRaw : Array.isArray(tRaw) ? tRaw[0] : "";

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
        <h1 className="text-xl font-semibold text-zinc-50">Device confirmation</h1>
        <p className="mt-4 text-sm text-zinc-400">
          This confirmation link is missing a token. Please sign in again to receive a new email.
        </p>
        <Link href="/dashboard/login" className="mt-6 text-sm text-blue-400 hover:underline">
          Back to login
        </Link>
      </main>
    );
  }

  const res = await consumeTwoFactorChallenge(token);
  if (res.ok) {
    await trustDeviceForUser(res.shopUserId, res.deviceIdHash);
    return confirmDeviceSuccessPage();
  }

  const reason =
    res.reason === "expired"
      ? "That confirmation link has expired. Please sign in again to receive a new link."
      : res.reason === "consumed"
        ? "That confirmation link was already used. If you still can’t sign in, try again from the login page."
        : "That confirmation link is invalid. Please sign in again to receive a new link.";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Device confirmation</h1>
      <p className="mt-4 text-sm text-zinc-400">{reason}</p>
      <Link href="/dashboard/login" className="mt-6 text-sm text-blue-400 hover:underline">
        Back to login
      </Link>
    </main>
  );
}

