-- CreateEnum
CREATE TYPE "FeaturePollOptionFollowUpKind" AS ENUM ('none', 'free_text', 'country_select');

-- AlterTable
ALTER TABLE "FeaturePollOption" ADD COLUMN     "followUpKind" "FeaturePollOptionFollowUpKind" NOT NULL DEFAULT 'none',
ADD COLUMN     "followUpPrompt" VARCHAR(500);

-- AlterTable
ALTER TABLE "FeaturePollVote" ADD COLUMN     "followUpAnswer" VARCHAR(500);
