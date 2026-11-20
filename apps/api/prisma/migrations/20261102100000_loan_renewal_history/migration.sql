CREATE TABLE "LoanRenewal" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "previousDueAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "renewedById" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'staff',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanRenewal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoanRenewal_loanId_createdAt_idx" ON "LoanRenewal"("loanId", "createdAt");
ALTER TABLE "LoanRenewal" ADD CONSTRAINT "LoanRenewal_loanId_fkey"
  FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanRenewal" ADD CONSTRAINT "LoanRenewal_renewedById_fkey"
  FOREIGN KEY ("renewedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
