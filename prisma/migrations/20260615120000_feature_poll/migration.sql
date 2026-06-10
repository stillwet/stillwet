-- CreateEnum
CREATE TYPE "FeaturePollOptionStatus" AS ENUM ('active', 'completed', 'removed');

-- CreateEnum
CREATE TYPE "FeaturePollVoterKind" AS ENUM ('shop', 'donor');

-- AlterTable
ALTER TABLE "SupportTip" ADD COLUMN "donorEmail" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SupportTip_donorEmail_idx" ON "SupportTip"("donorEmail");

-- CreateTable
CREATE TABLE "FeaturePollQuestion" (
    "id" TEXT NOT NULL,
    "prompt" VARCHAR(500) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturePollQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturePollOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "FeaturePollOptionStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturePollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturePollVote" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "voterKind" "FeaturePollVoterKind" NOT NULL,
    "shopId" TEXT,
    "shopDisplayName" VARCHAR(200),
    "donorEmail" VARCHAR(320),
    "supportTipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturePollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeaturePollQuestion_active_sortOrder_idx" ON "FeaturePollQuestion"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "FeaturePollOption_questionId_sortOrder_idx" ON "FeaturePollOption"("questionId", "sortOrder");

-- CreateIndex
CREATE INDEX "FeaturePollOption_questionId_status_idx" ON "FeaturePollOption"("questionId", "status");

-- CreateIndex
CREATE INDEX "FeaturePollVote_optionId_idx" ON "FeaturePollVote"("optionId");

-- CreateIndex
CREATE INDEX "FeaturePollVote_questionId_idx" ON "FeaturePollVote"("questionId");

-- CreateIndex
CREATE INDEX "FeaturePollVote_shopId_questionId_idx" ON "FeaturePollVote"("shopId", "questionId");

-- CreateIndex
CREATE INDEX "FeaturePollVote_donorEmail_idx" ON "FeaturePollVote"("donorEmail");

-- AddForeignKey
ALTER TABLE "FeaturePollOption" ADD CONSTRAINT "FeaturePollOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeaturePollQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePollVote" ADD CONSTRAINT "FeaturePollVote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeaturePollQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePollVote" ADD CONSTRAINT "FeaturePollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "FeaturePollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePollVote" ADD CONSTRAINT "FeaturePollVote_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePollVote" ADD CONSTRAINT "FeaturePollVote_supportTipId_fkey" FOREIGN KEY ("supportTipId") REFERENCES "SupportTip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
