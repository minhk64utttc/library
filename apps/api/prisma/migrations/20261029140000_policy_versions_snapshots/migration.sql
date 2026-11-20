INSERT INTO "Policy" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL DEFAULT 'global',
    "versionNumber" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "loanDays" INTEGER NOT NULL,
    "renewLimit" INTEGER NOT NULL,
    "renewDays" INTEGER NOT NULL,
    "maxActiveLoans" INTEGER NOT NULL,
    "overdueFinePerDay" INTEGER NOT NULL,
    "holdDays" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PolicyVersion" (
  "id", "scopeKey", "versionNumber", "effectiveFrom", "loanDays", "renewLimit",
  "renewDays", "maxActiveLoans", "overdueFinePerDay", "holdDays"
)
SELECT 'policy-default-v1', 'global', 1, TIMESTAMP '1970-01-01 00:00:00',
  "loanDays", "renewLimit", "renewDays", "maxActiveLoans", "overdueFinePerDay", "holdDays"
FROM "Policy" WHERE "id" = 'default';

ALTER TABLE "Loan"
  ADD COLUMN "renewLimit" INTEGER,
  ADD COLUMN "renewDays" INTEGER,
  ADD COLUMN "overdueFinePerDay" INTEGER,
  ADD COLUMN "policyVersionId" TEXT;

UPDATE "Loan" AS loan SET
  "renewLimit" = policy."renewLimit",
  "renewDays" = policy."renewDays",
  "overdueFinePerDay" = policy."overdueFinePerDay",
  "policyVersionId" = 'policy-default-v1'
FROM "Policy" AS policy WHERE policy."id" = 'default';

ALTER TABLE "Loan"
  ALTER COLUMN "renewLimit" SET NOT NULL,
  ALTER COLUMN "renewDays" SET NOT NULL,
  ALTER COLUMN "overdueFinePerDay" SET NOT NULL;

CREATE UNIQUE INDEX "PolicyVersion_scopeKey_versionNumber_key" ON "PolicyVersion"("scopeKey", "versionNumber");
CREATE UNIQUE INDEX "PolicyVersion_scopeKey_effectiveFrom_key" ON "PolicyVersion"("scopeKey", "effectiveFrom");
CREATE INDEX "PolicyVersion_scopeKey_effectiveFrom_idx" ON "PolicyVersion"("scopeKey", "effectiveFrom");
CREATE INDEX "Loan_policyVersionId_idx" ON "Loan"("policyVersionId");

ALTER TABLE "PolicyVersion"
  ADD CONSTRAINT "PolicyVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan"
  ADD CONSTRAINT "Loan_policyVersionId_fkey"
  FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
