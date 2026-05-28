import { formatDisplayedDateTime } from "@/lib/format-display-datetime";

/** Same as {@link formatDisplayedDateTime} — support bubbles use the app-wide MM/DD/YY time display. */
export function formatSupportMessageWhen(iso: string): string {
  const s = formatDisplayedDateTime(iso);
  return s === "—" ? iso : s;
}
