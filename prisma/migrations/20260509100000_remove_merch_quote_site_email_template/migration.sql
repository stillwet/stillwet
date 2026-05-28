-- Merch quote emails use built-in templates in code; remove optional DB override row.
DELETE FROM "SiteEmailTemplate" WHERE "key" = 'merch_quote_contact_inquiry';
