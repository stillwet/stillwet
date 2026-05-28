/**
 * Default displayed datetime across dashboard/admin UI: MM/DD/YY and 12-hour time with minutes,
 * in the viewer's local timezone.
 */
export function formatDisplayedDateTime(iso: string | number | Date | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}
