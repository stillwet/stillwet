import assert from "node:assert/strict";
import test from "node:test";
import { pacificCalendarDateKey, pacificParts } from "@/lib/promotion-period-pacific";

test("pacificCalendarDateKey returns YYYY-MM-DD from Pacific parts", () => {
  const key = pacificCalendarDateKey(new Date("2026-05-19T12:00:00Z"));
  const parts = pacificParts(new Date("2026-05-19T12:00:00Z"));
  const expected = `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
  assert.equal(key, expected);
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
});
