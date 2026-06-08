-- Add UI-only safe-area inset to mug wraparound presentation (export size unchanged).
UPDATE "AdminCatalogItem"
SET "itemCanvasPresentation" = jsonb_set(
  COALESCE("itemCanvasPresentation", '{}'::jsonb),
  '{safeAreaInsetFraction}',
  '{"x": 0.1, "y": 0.22}'::jsonb,
  true
)
WHERE name IN (
  'Ceramic Mug (white, 11 oz)',
  'Ceramic Mug (white, 15 oz)',
  'Ceramic Mug (Black, 11 oz)',
  'Ceramic Mug (Black, 15 oz)'
)
AND COALESCE("itemCanvasPresentation"->>'type', '') = 'wraparound';
