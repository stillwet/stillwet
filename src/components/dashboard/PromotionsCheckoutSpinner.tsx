/** Inline loading indicator for promotion checkout. */
export function PromotionsCheckoutSpinner(props: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-500/90 ${props.className ?? ""}`}
      aria-hidden
    />
  );
}
