-- Buyer return / defect claims (returns page form + admin tracker).
CREATE TYPE "OrderReturnClaimIssueType" AS ENUM ('misprint', 'defective');

CREATE TYPE "OrderReturnClaimStatus" AS ENUM ('new', 'accepted_wip', 'accepted_complete', 'rejected');

CREATE TABLE "OrderReturnClaim" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderNumber" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "cardLast4" VARCHAR(4) NOT NULL,
  "nameOnOrder" TEXT NOT NULL,
  "issueType" "OrderReturnClaimIssueType" NOT NULL,
  "adminCatalogItemId" TEXT NOT NULL,
  "catalogItemName" TEXT NOT NULL,
  "truthAcknowledged" BOOLEAN NOT NULL,
  "replacementPolicyAck" BOOLEAN NOT NULL,
  "status" "OrderReturnClaimStatus" NOT NULL DEFAULT 'new',
  "confirmationEmailSentAt" TIMESTAMP(3),
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderReturnClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderReturnClaimImage" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" VARCHAR(2048) NOT NULL,
  "imageR2Key" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderReturnClaimImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderReturnClaim"
  ADD CONSTRAINT "OrderReturnClaim_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderReturnClaim"
  ADD CONSTRAINT "OrderReturnClaim_adminCatalogItemId_fkey"
  FOREIGN KEY ("adminCatalogItemId") REFERENCES "AdminCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderReturnClaimImage"
  ADD CONSTRAINT "OrderReturnClaimImage_claimId_fkey"
  FOREIGN KEY ("claimId") REFERENCES "OrderReturnClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OrderReturnClaim_orderId_idx" ON "OrderReturnClaim"("orderId");
CREATE INDEX "OrderReturnClaim_orderNumber_idx" ON "OrderReturnClaim"("orderNumber");
CREATE INDEX "OrderReturnClaim_status_createdAt_idx" ON "OrderReturnClaim"("status", "createdAt" DESC);

CREATE INDEX "OrderReturnClaimImage_claimId_idx" ON "OrderReturnClaimImage"("claimId");
