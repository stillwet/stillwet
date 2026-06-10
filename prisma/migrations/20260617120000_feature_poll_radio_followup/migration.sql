-- AlterEnum
ALTER TYPE "FeaturePollOptionFollowUpKind" ADD VALUE 'radio_select';

-- AlterTable
ALTER TABLE "FeaturePollOption" ADD COLUMN "followUpChoices" TEXT;
