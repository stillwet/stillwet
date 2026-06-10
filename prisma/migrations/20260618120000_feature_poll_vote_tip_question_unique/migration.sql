-- Prevent spending the same support donation twice on one poll question.
CREATE UNIQUE INDEX "FeaturePollVote_supportTipId_questionId_key"
ON "FeaturePollVote"("supportTipId", "questionId")
WHERE "supportTipId" IS NOT NULL;
