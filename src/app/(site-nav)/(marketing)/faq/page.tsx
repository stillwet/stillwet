import { FaqPageContent } from "@/components/FaqPageContent";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Frequently Asked Questions</h1>

      <FaqPageContent />

      <SiteLegalFooter />
    </main>
  );
}
