import Link from "next/link";
import { FaqPageContent } from "@/components/FaqPageContent";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Frequently Asked Questions</h1>

      <FaqPageContent />

      <p className="mt-12">
        <Link href="/" className="text-sm text-blue-400/90 hover:underline">
          ← Home
        </Link>
      </p>
      <SiteLegalFooter />
    </main>
  );
}
