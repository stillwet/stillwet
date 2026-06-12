import Link from "next/link";
import { StorePanelCloseLink } from "@/components/StorePanelCloseButton";

type Props = {
  children: React.ReactNode;
  backHref: string;
  backLabel: string;
  /** When set, shows an “×” close button in the header (top right). */
  closeHref?: string;
  /** When false, hides the “← Back” link entirely. */
  showBackLink?: boolean;
  /** Small uppercase label above title (e.g. product type) */
  kicker?: string;
  title?: string;
  /**
   * When true, the header has no H1; caller renders the title in page content (e.g. product PDP
   * beside gallery).
   */
  omitHeaderTitle?: boolean;
  /** Centered column like template “card” */
  narrow?: boolean;
  /** Override horizontal padding (default document panel insets). */
  panelPaddingClass?: string;
};

const DEFAULT_PANEL_PADDING_CLASS = "px-6 sm:px-12 md:px-14";

export function StoreDocumentPanel({
  children,
  backHref,
  backLabel,
  closeHref,
  showBackLink = true,
  kicker,
  title,
  omitHeaderTitle = false,
  narrow = true,
  panelPaddingClass = DEFAULT_PANEL_PADDING_CLASS,
}: Props) {
  return (
    <article
      className={`pdp-container store-dimension-panel animate-store-panel-in relative pb-10 pt-0 sm:pb-12 ${panelPaddingClass} ${narrow ? "mx-auto max-w-3xl" : ""}`}
    >
      <header
        className={`relative mb-8 flex min-h-20 items-center border-b border-zinc-800/80 sm:min-h-[5.5rem] ${closeHref ? "pr-12 sm:pr-14" : ""}`}
      >
        {closeHref ? <StorePanelCloseLink href={closeHref} placement="header" /> : null}
        <div className="w-full">
          {showBackLink ? (
            <Link
              href={backHref}
              className="store-kicker inline-block text-blue-400/85 transition hover:text-blue-300"
            >
              ← {backLabel}
            </Link>
          ) : null}
          {kicker ? (
            <p className="store-kicker mt-3 text-zinc-500">{kicker}</p>
          ) : null}
          {omitHeaderTitle || !title ? null : (
            <h1 className="store-dimension-page-title mt-2 text-2xl text-zinc-50 sm:text-3xl">
              {title}
            </h1>
          )}
        </div>
      </header>
      <div className="text-zinc-300">{children}</div>
    </article>
  );
}
