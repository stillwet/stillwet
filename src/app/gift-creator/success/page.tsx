import Link from "next/link";

export const dynamic = "force-dynamic";

export default function GiftCreatorSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Gift received</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        Payment received. We&apos;ll email you your code.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500">
        Send those codes to the creator off-platform when you’re ready.
      </p>
      <Link href="/" className="mt-8 text-sm text-blue-400 hover:underline">
        Return home
      </Link>
    </main>
  );
}
