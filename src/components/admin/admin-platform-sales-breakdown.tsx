export function formatAdminPlatformSalesPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function BreakdownLabelHint({
  label,
  hint,
  hintPosition = "below",
  elevated = false,
}: {
  label: string;
  hint: string;
  hintPosition?: "above" | "below";
  /** Higher stacking when nested inside fixed popups. */
  elevated?: boolean;
}) {
  const hintZ = elevated ? "z-[110]" : "z-20";
  const hintClass =
    hintPosition === "above"
      ? `absolute bottom-full left-0 ${hintZ} mb-1 w-max max-w-[14rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] normal-case tracking-normal text-zinc-300 shadow-lg`
      : `absolute left-0 top-full ${hintZ} mt-1 w-max max-w-[14rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] normal-case tracking-normal text-zinc-300 shadow-lg`;

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <details className="relative inline-block">
        <summary
          className="inline-flex h-3.5 w-3.5 cursor-help list-none items-center justify-center rounded-full border border-zinc-600 text-[9px] font-semibold leading-none text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 [&::-webkit-details-marker]:hidden"
          aria-label={`About ${label}`}
        >
          ?
        </summary>
        <p className={hintClass}>{hint}</p>
      </details>
    </span>
  );
}

export type PlatformSalesBreakdownRow = {
  label: string;
  cents: number;
  displayValue?: string;
  emphasize?: boolean;
  /** Muted gray amount (platform fee lines below Paid/COGS/Stripe). */
  mutedValue?: boolean;
  hint?: string;
  hintPosition?: "above" | "below";
};

export function PlatformRevenueBreakdownTable({
  subtle = false,
  solidBackground = false,
  sectionTitle,
  headerTotalCents,
  rows,
}: {
  subtle?: boolean;
  /** Opaque panel background (line-detail popups). */
  solidBackground?: boolean;
  sectionTitle: string;
  headerTotalCents?: number;
  rows: PlatformSalesBreakdownRow[];
}) {
  const wrapClass = solidBackground
    ? "overflow-visible rounded-md border border-zinc-800 bg-zinc-950"
    : subtle
      ? "overflow-hidden rounded-md border border-zinc-800/40"
      : "overflow-hidden rounded-md border border-zinc-800/70";
  const headerWrapClass = solidBackground
    ? "border-b border-blue-500/45 bg-zinc-900 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
    : subtle
      ? "border-b border-blue-500/25 bg-blue-950/20 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
      : "border-b border-blue-500/45 bg-blue-950/35 px-2 py-1 text-[10px] font-medium uppercase tracking-wide";
  const headerTitleClass = subtle ? "text-blue-400/55" : "text-blue-400/90";
  const headerTotalClass = subtle ? "tabular-nums text-blue-200/75" : "tabular-nums text-blue-100";
  const labelClass = "text-right text-[10px] uppercase tracking-wide text-zinc-600";
  const rowBorder = solidBackground ? "border-zinc-800" : subtle ? "border-zinc-800/35" : "border-zinc-800/50";
  const emphasizeRow = solidBackground ? "bg-zinc-900" : subtle ? "bg-zinc-950/25" : "bg-zinc-950/40";

  return (
    <div className={wrapClass}>
      <div className={`${headerWrapClass} flex items-baseline justify-between gap-2`}>
        <span className={headerTitleClass}>{sectionTitle}</span>
        {headerTotalCents != null ? (
          <span className={headerTotalClass}>{formatAdminPlatformSalesPrice(headerTotalCents)}</span>
        ) : null}
      </div>
      <table className={`w-full border-collapse text-xs${solidBackground ? " overflow-visible" : ""}`}>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={`border-b ${rowBorder} last:border-b-0 ${row.emphasize ? emphasizeRow : ""}`}
            >
              <td className={`overflow-visible px-2 py-1.5 ${labelClass}`}>
                {row.hint ? (
                  <BreakdownLabelHint
                    label={row.label}
                    hint={row.hint}
                    hintPosition={row.hintPosition}
                    elevated={solidBackground}
                  />
                ) : (
                  row.label
                )}
              </td>
              <td
                className={`px-2 py-1.5 text-right tabular-nums ${
                  row.mutedValue ? "text-zinc-500" : subtle ? "text-zinc-400" : "text-zinc-200"
                }`}
              >
                {row.displayValue ?? formatAdminPlatformSalesPrice(row.cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
