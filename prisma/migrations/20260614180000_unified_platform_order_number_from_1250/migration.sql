-- One shared order-number sequence for buyer `Order` rows and every platform checkout type.
-- Existing rows are unchanged; the next allocated number is at least 1253.

DELETE FROM "PlatformTransactionSequence" WHERE "productKey" <> 'global';

WITH high_water AS (
  SELECT GREATEST(
    1252,
    COALESCE((SELECT MAX("orderNumber") FROM "Order"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "SupportTip"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "ShopFlairPurchase"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "ShopGoogleShoppingPurchase"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "PromotionPurchase"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "ListingCreditPackPurchase"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "ShopSetupFeePurchase"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "ShopReactivationPurchase"), 0),
    COALESCE((SELECT MAX("transactionNumber") FROM "CreatorGiftPurchase"), 0)
  ) AS v
)
INSERT INTO "PlatformTransactionSequence" ("productKey", "lastNumber")
SELECT 'global', v FROM high_water
ON CONFLICT ("productKey") DO UPDATE
SET "lastNumber" = GREATEST("PlatformTransactionSequence"."lastNumber", EXCLUDED."lastNumber");

SELECT setval(
  '"Order_orderNumber_seq"',
  (SELECT "lastNumber" FROM "PlatformTransactionSequence" WHERE "productKey" = 'global'),
  true
);

ALTER TABLE "Order" ALTER COLUMN "orderNumber" DROP DEFAULT;
