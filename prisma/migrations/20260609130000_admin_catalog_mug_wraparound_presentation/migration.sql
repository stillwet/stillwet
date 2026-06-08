-- Apply wraparound mug canvas presentation to ceramic mug catalog rows (UI-only; export unchanged).
UPDATE "AdminCatalogItem"
SET "itemCanvasPresentation" = '{
  "type": "wraparound",
  "verticalGuideFractions": [0.25, 0.5, 0.75],
  "orientationPreviews": [
    { "label": "Left", "assetKey": "mug-white-handle-left", "alignGuideIndex": 0 },
    { "label": "Center", "assetKey": "mug-white-handle-center", "alignGuideIndex": 1 },
    { "label": "Right", "assetKey": "mug-white-handle-right", "alignGuideIndex": 2 }
  ]
}'::jsonb
WHERE name IN (
  'Ceramic Mug (white, 11 oz)',
  'Ceramic Mug (white, 15 oz)',
  'Ceramic Mug (Black, 11 oz)',
  'Ceramic Mug (Black, 15 oz)'
);
