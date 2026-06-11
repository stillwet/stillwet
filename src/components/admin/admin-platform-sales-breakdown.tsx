import { BreakdownLabelHint } from "@/components/admin/BreakdownLabelHint";

export { BreakdownLabelHint };

export function formatAdminPlatformSalesPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export type PlatformSalesBreakdownRow = {
  label: string;
  cents: number;
  displayValue?: string;
  emphasize?: boolean;
  /** Muted gray amount (platform fee lines below Paid/COGS/Stripe). */
  mutedValue?: boolean;
  /** Full-brightness amount (e.g. shop payout subheader). */
  brightValue?: boolean;
  /** Mid-table group header (e.g. application amount before COGS). */
  subheader?: boolean;
  /** Indented row under a subheader. */
  nested?: boolean;
  /** Shown below the application-amount group; not part of that subtotal. */
  referenceOnly?: boolean;
  hint?: string;
  hintPosition?: "above" | "below";
};

export function PlatformRevenueBreakdownTable({
  subtle = false,
  solidBackground = false,
  tone = "platform",
  layout = "table",
  sectionTitle,
  headerTotalCents,
  rows,
}: {
  subtle?: boolean;
  /** Opaque panel background (line-detail popups). */
  solidBackground?: boolean;
  /** Platform sales breakdowns use blue headers; shop merchandise uses neutral zinc. */
  tone?: "platform" | "shop";
  /** `stacked` puts label and amount on separate lines (narrow viewports). */
  layout?: "table" | "stacked";
  sectionTitle: string;
  headerTotalCents?: number;
  rows: PlatformSalesBreakdownRow[];
}) {
  const subtleTone = subtle;
  const shopHeader = tone === "shop";
  const wrapClass = solidBackground
    ? "overflow-visible rounded-md border border-zinc-800 bg-zinc-950"
    : subtle
      ? "overflow-hidden rounded-md border border-zinc-800/40"
      : "overflow-hidden rounded-md border border-zinc-800/70";
  const headerWrapClass = shopHeader
    ? solidBackground
      ? "border-b border-blue-500/55 bg-blue-950/55 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
      : subtleTone
        ? "border-b border-blue-500/40 bg-blue-950/35 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
        : "border-b border-blue-500/55 bg-blue-950/45 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
    : solidBackground
      ? "border-b border-blue-500/45 bg-zinc-900 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
      : subtleTone
        ? "border-b border-blue-500/25 bg-blue-950/20 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
        : "border-b border-blue-500/45 bg-blue-950/35 px-2 py-1 text-[10px] font-medium uppercase tracking-wide";
  const headerTitleClass = shopHeader
    ? subtleTone
      ? "text-blue-400/90"
      : "text-blue-400"
    : subtleTone
      ? "text-blue-400/55"
      : "text-blue-400/90";
  const headerTotalClass = shopHeader
    ? subtleTone
      ? "text-xs normal-case tabular-nums text-blue-300/90"
      : "text-xs normal-case tabular-nums text-blue-200"
    : subtleTone
      ? "text-xs normal-case tabular-nums text-blue-200/75"
      : "text-xs normal-case tabular-nums text-blue-100";
  const labelClass = "text-right text-[10px] uppercase tracking-wide text-zinc-600";
  const nestedLabelClass = "text-right text-[10px] uppercase tracking-wide text-zinc-600 pl-3";
  const subheaderLabelClass =
    "text-right text-[10px] font-medium uppercase tracking-wide text-zinc-400";
  const rowBorder = solidBackground ? "border-zinc-800" : subtle ? "border-zinc-800/35" : "border-zinc-800/50";
  const emphasizeRow = solidBackground ? "bg-zinc-900" : subtle ? "bg-zinc-950/25" : "bg-zinc-950/40";
  const subheaderRow = solidBackground ? "bg-zinc-900/95" : subtle ? "bg-zinc-950/40" : "bg-zinc-950/55";
  const stacked = layout === "stacked";

  function rowLabelClass(row: PlatformSalesBreakdownRow) {
    if (row.subheader) return subheaderLabelClass;
    if (row.nested) return nestedLabelClass;
    return labelClass;
  }

  function rowValueClass(row: PlatformSalesBreakdownRow) {
    if (row.brightValue) return "text-white";
    if (row.subheader || row.mutedValue) return "text-zinc-500";
    if (subtle) return "text-zinc-400";
    return "text-zinc-200";
  }

  function renderRowLabel(row: PlatformSalesBreakdownRow) {
    if (row.hint) {
      return (
        <BreakdownLabelHint
          label={row.label}
          hint={row.hint}
          hintPosition={row.hintPosition}
          elevated={solidBackground}
        />
      );
    }
    return row.label;
  }

  function renderRowValue(row: PlatformSalesBreakdownRow) {
    return row.displayValue ?? formatAdminPlatformSalesPrice(row.cents);
  }

  return (
    <div className={wrapClass}>
      <div
        className={`${headerWrapClass} flex items-baseline justify-between gap-2 ${
          stacked ? "flex-wrap" : ""
        }`}
      >
        <span className={`${headerTitleClass}${stacked ? " min-w-0 break-words" : ""}`}>
          {sectionTitle}
        </span>
        {headerTotalCents != null ? (
          <span className={`${headerTotalClass} shrink-0`}>
            {formatAdminPlatformSalesPrice(headerTotalCents)}
          </span>
        ) : null}
      </div>
      {stacked ? (
        <div className={`divide-y ${rowBorder}`}>
          {rows.map((row) => (
            <div
              key={row.label}
              className={`px-2 py-1.5 ${
                row.subheader ? subheaderRow : row.emphasize ? emphasizeRow : ""
              }`}
            >
              <div className={`${rowLabelClass(row)} break-words`}>{renderRowLabel(row)}</div>
              <div className={`mt-0.5 text-right text-xs tabular-nums ${rowValueClass(row)}`}>
                {renderRowValue(row)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className={`w-full border-collapse text-xs${solidBackground ? " overflow-visible" : ""}`}>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={`border-b ${rowBorder} last:border-b-0 ${
                  row.subheader ? subheaderRow : row.emphasize ? emphasizeRow : ""
                }`}
              >
                <td className={`overflow-visible px-2 py-1.5 ${rowLabelClass(row)}`}>
                  {renderRowLabel(row)}
                </td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${rowValueClass(row)}`}>
                  {renderRowValue(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
