import { SupportSiteCta } from "@/components/SupportSiteCta";
import { isSupportCheckoutConfigured } from "@/lib/support-site";

export function SiteLegalFooter() {
  const supportAvailable = isSupportCheckoutConfigured();

  return (
    <footer className="mt-16 border-t border-zinc-800/80 pt-8 text-center text-xs text-zinc-500">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <a href="/about" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          About
        </a>
        <a href="/faq" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          FAQ
        </a>
        <a href="/returns" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          Returns &amp; refunds
        </a>
        <a href="/privacy" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          Privacy
        </a>
        <a href="/terms" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          Terms
        </a>
        <a href="/shop-regulations" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          Shop regulations
        </a>
        <a href="/admin" className="store-kicker text-zinc-600 transition hover:text-zinc-400">
          Admin
        </a>
      </nav>
      {supportAvailable ? (
        <div className="mt-6 max-w-md mx-auto">
          <SupportSiteCta />
        </div>
      ) : null}
    </footer>
  );
}
