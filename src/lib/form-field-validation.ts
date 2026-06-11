/** Client-side copy for common fields (replaces browser-native validation bubbles). */

export function requiredFieldError(value: unknown, fieldLabel: string): string | null {
  const s = typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
  if (!s) return `Enter ${fieldLabel.toLowerCase()} to continue.`;
  return null;
}

export function emailFieldError(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
  if (!s) return "Enter your email to continue.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "Enter a valid email address.";
  return null;
}
