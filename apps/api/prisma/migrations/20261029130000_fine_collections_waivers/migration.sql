CREATE TYPE "FineWaiverStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "FinePayment" (
    "id" TEXT NOT NULL,
    "fineId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "remainingAfter" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FineWaiverRequest" (
    "id" TEXT NOT NULL,
    "fineId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "requestedAmount" INTEGER NOT NULL,
    "approvedAmount" INTEGER,
    "reason" TEXT NOT NULL,
    "decisionReason" TEXT,
    "status" "FineWaiverStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "FineWaiverRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinePayment_idempotencyKey_key" ON "FinePayment"("idempotencyKey");
CREATE UNIQUE INDEX "FinePayment_receiptNumber_key" ON "FinePayment"("receiptNumber");
CREATE INDEX "FinePayment_fineId_receivedAt_idx" ON "FinePayment"("fineId", "receivedAt");
CREATE UNIQUE INDEX "FineWaiverRequest_one_pending_per_fine_key"
  ON "FineWaiverRequest"("fineId") WHERE "status" = 'pending';
CREATE INDEX "FineWaiverRequest_fineId_status_idx" ON "FineWaiverRequest"("fineId", "status");
CREATE INDEX "FineWaiverRequest_status_createdAt_idx" ON "FineWaiverRequest"("status", "createdAt");

ALTER TABLE "FinePayment"
  ADD CONSTRAINT "FinePayment_fineId_fkey"
  FOREIGN KEY ("fineId") REFERENCES "Fine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinePayment"
  ADD CONSTRAINT "FinePayment_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FineWaiverRequest"
  ADD CONSTRAINT "FineWaiverRequest_fineId_fkey"
  FOREIGN KEY ("fineId") REFERENCES "Fine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FineWaiverRequest"
  ADD CONSTRAINT "FineWaiverRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FineWaiverRequest"
  ADD CONSTRAINT "FineWaiverRequest_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
