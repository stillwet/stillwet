-- Rejection reason + decision emails for buyer return claims.
CREATE TYPE "OrderReturnClaimRejectionReason" AS ENUM ('past_claim_window', 'does_not_meet_policy');

ALTER TABLE "OrderReturnClaim"
  ADD COLUMN "rejectionReason" "OrderReturnClaimRejectionReason",
  ADD COLUMN "rejectionEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "acceptedEmailSentAt" TIMESTAMP(3);
