/** Parse buyer-entered order number (#1234, Order 1234, 1234). */
export function parseBuyerOrderNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/^#+\s*/i, "").replace(/^order\s*#?\s*/i, "").trim();
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

function normalizePersonName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buyerOrderNameMatches(shippingName: string | null | undefined, entered: string): boolean {
  const a = normalizePersonName(shippingName ?? "");
  const b = normalizePersonName(entered);
  if (!a || !b) return false;
  return a === b;
}

export function buyerOrderEmailMatches(orderEmail: string | null | undefined, entered: string): boolean {
  const a = orderEmail?.trim().toLowerCase() ?? "";
  const b = entered.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
}
