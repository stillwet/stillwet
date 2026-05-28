-- Enforce unique shop display names (case-insensitive; outer whitespace ignored).
-- Aligns with app checks in `src/lib/shop-display-name-uniqueness.ts`.
-- If this fails, resolve duplicate LOWER(TRIM("displayName")) rows first.
CREATE UNIQUE INDEX "Shop_displayName_ci_trim_unique"
ON "Shop" (LOWER(TRIM("displayName")));
