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
  sectionTitle,
  headerTotalCents,
  rows,
}: {
  subtle?: boolean;
  /** Opaque panel background (line-detail popups). */
  solidBackground?: boolean;
  /** Platform sales breakdowns use blue headers; shop merchandise uses neutral zinc. */
  tone?: "platform" | "shop";
  sectionTitle: string;
  headerTotalCents?: number;
  rows: PlatformSalesBreakdownRow[];
}) {
  const subtleTone = subtle;
  const wrapClass = solidBackground
    ? "overflow-visible rounded-md border border-zinc-800 bg-zinc-950"
    : subtle
      ? "overflow-hidden rounded-md border border-zinc-800/40"
      : "overflow-hidden rounded-md border border-zinc-800/70";
  const headerWrapClass = solidBackground
    ? "border-b border-blue-500/45 bg-zinc-900 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
    : subtleTone
      ? "border-b border-blue-500/25 bg-blue-950/20 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
      : "border-b border-blue-500/45 bg-blue-950/35 px-2 py-1 text-[10px] font-medium uppercase tracking-wide";
  const headerTitleClass = subtleTone ? "text-blue-400/55" : "text-blue-400/90";
  const headerTotalClass = subtleTone
    ? "text-xs normal-case tabular-nums text-blue-200/75"
    : "text-xs normal-case tabular-nums text-blue-100";
  const labelClass = "text-right text-[10px] uppercase tracking-wide text-zinc-600";
  const nestedLabelClass = "text-right text-[10px] uppercase tracking-wide text-zinc-600 pl-3";
  const subheaderLabelClass =
    "text-right text-[10px] font-medium uppercase tracking-wide text-zinc-400";
  const rowBorder = solidBackground ? "border-zinc-800" : subtle ? "border-zinc-800/35" : "border-zinc-800/50";
  const emphasizeRow = solidBackground ? "bg-zinc-900" : subtle ? "bg-zinc-950/25" : "bg-zinc-950/40";
  const subheaderRow = solidBackground ? "bg-zinc-900/95" : subtle ? "bg-zinc-950/40" : "bg-zinc-950/55";

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
              className={`border-b ${rowBorder} last:border-b-0 ${
                row.subheader ? subheaderRow : row.emphasize ? emphasizeRow : ""
              }`}
            >
              <td
                className={`overflow-visible px-2 py-1.5 ${
                  row.subheader ? subheaderLabelClass : row.nested ? nestedLabelClass : labelClass
                }`}
              >
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
                  row.subheader
                    ? "text-zinc-500"
                    : row.mutedValue
                      ? "text-zinc-500"
                      : subtle
                        ? "text-zinc-400"
                        : "text-zinc-200"
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
