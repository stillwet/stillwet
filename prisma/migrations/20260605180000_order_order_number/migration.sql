-- Sequential buyer-facing order number for merchandise purchases.
ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "Order"
)
UPDATE "Order" AS o
SET "orderNumber" = n.rn
FROM numbered AS n
WHERE o.id = n.id;

CREATE SEQUENCE "Order_orderNumber_seq";

SELECT setval(
  '"Order_orderNumber_seq"',
  COALESCE((SELECT MAX("orderNumber") FROM "Order"), 0) + 1,
  false
);

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"');
ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
