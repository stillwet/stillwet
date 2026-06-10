import Link from "next/link";

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
      className={`store-dimension-panel animate-store-panel-in relative pb-10 pt-0 sm:pb-12 ${panelPaddingClass} ${narrow ? "mx-auto max-w-3xl" : ""}`}
    >
      <header className="mb-8 flex min-h-20 items-center border-b border-zinc-800/80 sm:min-h-[5.5rem]">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
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
          {closeHref ? (
            <Link
              href={closeHref}
              aria-label="Close"
              className="store-dimension-panel inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/90 text-lg leading-none text-zinc-400 shadow-sm backdrop-blur-sm transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100"
            >
              ×
            </Link>
          ) : null}
        </div>
      </header>
      <div className="text-zinc-300">{children}</div>
    </article>
  );
}
