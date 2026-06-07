-- Next merchandise order number is at least 1250 (existing rows unchanged).
SELECT setval(
  '"Order_orderNumber_seq"',
  GREATEST(1249, (SELECT COALESCE(MAX("orderNumber"), 0) FROM "Order")),
  true
);
