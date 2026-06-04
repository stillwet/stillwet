-- CreateTable
CREATE TABLE "AdminNexusRegistrationDates" (
    "id" TEXT NOT NULL,
    "datesByCode" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNexusRegistrationDates_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AdminNexusRegistrationDates" ("id", "datesByCode", "updatedAt")
VALUES ('default', '{}'::jsonb, CURRENT_TIMESTAMP);
