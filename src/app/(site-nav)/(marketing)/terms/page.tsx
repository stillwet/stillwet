import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { TermsConditionsContent } from "@/components/TermsConditionsContent";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <TermsConditionsContent />

      <SiteLegalFooter />
    </main>
  );
}
