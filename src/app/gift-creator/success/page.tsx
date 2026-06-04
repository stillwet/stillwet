import Link from "next/link";
import { GiftCreatorSuccessHeader } from "@/components/GiftCreatorSuccessHeader";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GiftCreatorSuccessPage(props: {
  searchParams: Promise<{ mode?: string; shop?: string }>;
}) {
  const searchParams = await props.searchParams;
  const mode = searchParams.mode === "direct" ? "direct" : "setup";
  const shopSlug = searchParams.shop?.trim() ?? "";

  let shopDisplayName: string | null = null;
  if (mode === "direct" && shopSlug) {
    const shop = await prisma.shop.findUnique({
      where: { slug: shopSlug },
      select: { displayName: true },
    });
    shopDisplayName = shop?.displayName ?? shopSlug;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <GiftCreatorSuccessHeader mode={mode} />

      {mode === "direct" ? (
        <>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Payment received
            {shopDisplayName ? (
              <>
                {" "}
                — credits were sent to <span className="text-zinc-200">{shopDisplayName}</span>.
              </>
            ) : (
              " — credits were sent to the shop you selected."
            )}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            The creator will see an announcement in their dashboard.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Payment received. We&apos;ll email you your setup code.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Share that code with the creator when they&apos;re ready to open their shop.
          </p>
        </>
      )}

      <Link href="/" className="mt-8 text-sm text-blue-400 hover:underline">
        Return home
      </Link>
    </main>
  );
}
