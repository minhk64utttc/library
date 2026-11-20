CREATE TYPE "LibraryCardStatus" AS ENUM ('active', 'locked');

CREATE TABLE "LibraryCard" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "status" "LibraryCardStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryCardEvent" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "previousExpiresAt" TIMESTAMP(3),
    "newExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryCardEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibraryCard_accountId_key" ON "LibraryCard"("accountId");
CREATE UNIQUE INDEX "LibraryCard_cardNumber_key" ON "LibraryCard"("cardNumber");
CREATE INDEX "LibraryCard_status_expiresAt_idx" ON "LibraryCard"("status", "expiresAt");
CREATE INDEX "LibraryCardEvent_cardId_createdAt_idx" ON "LibraryCardEvent"("cardId", "createdAt");

ALTER TABLE "LibraryCard"
  ADD CONSTRAINT "LibraryCard_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryCardEvent"
  ADD CONSTRAINT "LibraryCardEvent_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "LibraryCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryCardEvent"
  ADD CONSTRAINT "LibraryCardEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
