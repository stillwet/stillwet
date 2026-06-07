import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { TermsConditionsContent } from "@/components/TermsConditionsContent";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <TermsConditionsContent />

      <p className="mt-12">
        <Link href="/" className="text-sm text-blue-400/90 hover:underline">
          ← Home
        </Link>
      </p>
      <SiteLegalFooter />
    </main>
  );
}
