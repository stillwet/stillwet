-- Expand white letterbox backfill for large home-goods and large print templates.
UPDATE "AdminCatalogItem"
SET "itemArtworkLetterboxFill" = 'white'
WHERE "itemArtworkLetterboxFill" = 'transparent'
  AND (
    "itemLargeListingArtwork" = true
    OR LOWER("name") LIKE '%blanket%'
    OR LOWER("name") LIKE '%body pillow%'
    OR LOWER("name") LIKE '%bodypillow%'
    OR LOWER("name") LIKE '%throw pillow%'
    OR LOWER("name") LIKE '%fleece%'
    OR LOWER("name") LIKE '%tapestry%'
    OR LOWER("name") LIKE '%wall art%'
    OR LOWER("name") LIKE '%sherpa%'
    OR LOWER("name") LIKE '%duvet%'
    OR LOWER("name") LIKE '%comforter%'
    OR LOWER("name") LIKE '%quilt%'
    OR LOWER("name") LIKE '%bed sheet%'
    OR LOWER("name") LIKE '%sheet set%'
    OR LOWER("name") LIKE '%banner%'
    OR LOWER("name") LIKE '%flag%'
    OR LOWER("name") LIKE '%bath mat%'
    OR LOWER("name") LIKE '%floor mat%'
    OR LOWER("name") LIKE '%yard sign%'
    OR LOWER("name") LIKE '%acrylic%'
    OR LOWER("name") LIKE '%metal print%'
    OR LOWER("name") LIKE '%wood print%'
    OR LOWER("name") LIKE '%framed%'
    OR LOWER("name") LIKE '%rug%'
  );

UPDATE "AdminCatalogItem"
SET "itemArtworkLetterboxFill" = 'white'
WHERE "itemArtworkLetterboxFill" = 'transparent'
  AND "itemPrintAreaWidthPx" IS NOT NULL
  AND "itemPrintAreaHeightPx" IS NOT NULL
  AND "itemPrintAreaWidthPx" > 0
  AND "itemPrintAreaHeightPx" > 0
  AND ("itemPrintAreaWidthPx" * "itemPrintAreaHeightPx") >= 6000000
  AND LOWER("name") NOT LIKE '%mug%'
  AND LOWER("name") NOT LIKE '%tee%'
  AND LOWER("name") NOT LIKE '%shirt%'
  AND LOWER("name") NOT LIKE '%hoodie%'
  AND LOWER("name") NOT LIKE '%apparel%'
  AND LOWER("name") NOT LIKE '%tank%'
  AND LOWER("name") NOT LIKE '%sticker%'
  AND LOWER("name") NOT LIKE '%phone case%'
  AND LOWER("name") NOT LIKE '%tote%'
  AND LOWER("name") NOT LIKE '%bag%'
  AND LOWER("name") NOT LIKE '%hat%'
  AND LOWER("name") NOT LIKE '%cap%'
  AND LOWER("name") NOT LIKE '%sock%'
  AND LOWER("name") NOT LIKE '%sweatshirt%'
  AND LOWER("name") NOT LIKE '%long sleeve%'
  AND LOWER("name") NOT LIKE '%crop top%'
  AND LOWER("name") NOT LIKE '%legging%'
  AND LOWER("name") NOT LIKE '%brief%'
  AND LOWER("name") NOT LIKE '%thong%'
  AND LOWER("name") NOT LIKE '%panty%'
  AND LOWER("name") NOT LIKE '%boxer%'
  AND LOWER("name") NOT LIKE '%bikini%'
  AND LOWER("name") NOT LIKE '%swimsuit%'
  AND LOWER("name") NOT LIKE '%pin%'
  AND LOWER("name") NOT LIKE '%patch%'
  AND LOWER("name") NOT LIKE '%embroidery%';
