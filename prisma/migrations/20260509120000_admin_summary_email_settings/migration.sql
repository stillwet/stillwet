-- CreateEnum
CREATE TYPE "AdminSummaryEmailFrequency" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateTable
CREATE TABLE "AdminSummaryEmailSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "recipientEmails" JSONB NOT NULL DEFAULT '[]',
    "frequency" "AdminSummaryEmailFrequency" NOT NULL DEFAULT 'daily',
    "hourLa" INTEGER NOT NULL DEFAULT 16,
    "minuteLa" INTEGER NOT NULL DEFAULT 0,
    "weeklyIsoWeekday" INTEGER NOT NULL DEFAULT 1,
    "monthlyDay" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3),
    "lastSentPeriodKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSummaryEmailSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AdminSummaryEmailSettings" ("id", "enabled", "recipientEmails", "frequency", "hourLa", "minuteLa", "weeklyIsoWeekday", "monthlyDay", "updatedAt")
VALUES ('default', false, '[]'::jsonb, 'daily', 16, 0, 1, 1, CURRENT_TIMESTAMP);
