-- One donor vote per support payment (any poll question), not per question.
DELETE FROM "FeaturePollVote"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "supportTipId"
        ORDER BY "createdAt" ASC
      ) AS "rowNum"
    FROM "FeaturePollVote"
    WHERE "supportTipId" IS NOT NULL
  ) AS "duplicates"
  WHERE "rowNum" > 1
);

DROP INDEX IF EXISTS "FeaturePollVote_supportTipId_questionId_key";

CREATE UNIQUE INDEX "FeaturePollVote_supportTipId_key"
ON "FeaturePollVote"("supportTipId")
WHERE "supportTipId" IS NOT NULL;
