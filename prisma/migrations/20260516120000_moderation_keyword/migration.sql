-- Creator text moderation: admin-managed phrase bank.

CREATE TABLE "ModerationKeyword" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "phraseNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationKeyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModerationKeyword_phraseNormalized_key" ON "ModerationKeyword"("phraseNormalized");

INSERT INTO "ModerationKeyword" ("id", "phrase", "phraseNormalized", "createdAt") VALUES
    ('modkwseed001', 'Pay me', 'pay me', CURRENT_TIMESTAMP),
    ('modkwseed002', 'Tribute', 'tribute', CURRENT_TIMESTAMP),
    ('modkwseed003', 'Domme', 'domme', CURRENT_TIMESTAMP),
    ('modkwseed004', 'Mistress', 'mistress', CURRENT_TIMESTAMP),
    ('modkwseed005', 'Fuck me', 'fuck me', CURRENT_TIMESTAMP),
    ('modkwseed006', 'Serve me', 'serve me', CURRENT_TIMESTAMP);
