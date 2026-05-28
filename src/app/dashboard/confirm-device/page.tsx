import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmDeviceClient } from "@/app/dashboard/confirm-device/ConfirmDeviceClient";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function ConfirmDevicePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tRaw = sp.t;
  const token = typeof tRaw === "string" ? tRaw : Array.isArray(tRaw) ? tRaw[0] : "";
  const sentRaw = sp.sent;
  const sent = sentRaw === "1" || (Array.isArray(sentRaw) && sentRaw[0] === "1");
  const confirmedRaw = sp.confirmed;
  const confirmed = confirmedRaw === "1" || (Array.isArray(confirmedRaw) && confirmedRaw[0] === "1");

  if (token) {
    // Backwards compatibility: older emails pointed to /dashboard/confirm-device?t=...
    // Redirect to the public confirmation page so the email opener never lands on dashboard UX.
    redirect(`/confirm-device?t=${encodeURIComponent(token)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-50">Confirm device</h1>
      <p className="mt-4 text-sm text-zinc-400">
        {confirmed
          ? "Device confirmed. Return to the device you’re signing in on to finish logging in."
          : sent
            ? "We emailed you a confirmation link. Open it to finish signing in."
            : "Check your email for a confirmation link to finish signing in."}
      </p>
      {sent ? <ConfirmDeviceClient /> : null}
      <p className="mt-3 text-xs text-zinc-600">
        If you don’t see it, check spam. You can also try signing in again to receive a fresh link.
      </p>
      <Link href="/dashboard/login" className="mt-6 text-sm text-blue-400 hover:underline">
        Back to login
      </Link>
    </main>
  );
}

