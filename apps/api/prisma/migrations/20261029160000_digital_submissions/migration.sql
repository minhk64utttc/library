CREATE TYPE "DigitalSubmissionStatus" AS ENUM ('new_submission', 'under_review', 'need_more_info', 'accepted', 'published');
CREATE TYPE "DigitalAccessLevel" AS ENUM ('public', 'members_only', 'campus_only', 'restricted');

CREATE TABLE "DigitalSubmission" (
  "id" TEXT NOT NULL,
  "submissionCode" TEXT NOT NULL,
  "submitterId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "abstract" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "department" TEXT,
  "publishedYear" INTEGER,
  "license" TEXT NOT NULL,
  "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "status" "DigitalSubmissionStatus" NOT NULL DEFAULT 'new_submission',
  "accessLevel" "DigitalAccessLevel",
  "reviewNote" TEXT,
  "publicationNote" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DigitalSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalFileVersion" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalFileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalSubmissionEvent" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "accessLevel" "DigitalAccessLevel",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalSubmissionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DigitalSubmission_submissionCode_key" ON "DigitalSubmission"("submissionCode");
CREATE INDEX "DigitalSubmission_submitterId_createdAt_idx" ON "DigitalSubmission"("submitterId", "createdAt");
CREATE INDEX "DigitalSubmission_status_submittedAt_idx" ON "DigitalSubmission"("status", "submittedAt");
CREATE UNIQUE INDEX "DigitalFileVersion_storageKey_key" ON "DigitalFileVersion"("storageKey");
CREATE UNIQUE INDEX "DigitalFileVersion_submissionId_versionNumber_key" ON "DigitalFileVersion"("submissionId", "versionNumber");
CREATE INDEX "DigitalFileVersion_submissionId_createdAt_idx" ON "DigitalFileVersion"("submissionId", "createdAt");
CREATE INDEX "DigitalSubmissionEvent_submissionId_createdAt_idx" ON "DigitalSubmissionEvent"("submissionId", "createdAt");

ALTER TABLE "DigitalSubmission" ADD CONSTRAINT "DigitalSubmission_submitterId_fkey"
  FOREIGN KEY ("submitterId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DigitalFileVersion" ADD CONSTRAINT "DigitalFileVersion_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "DigitalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalFileVersion" ADD CONSTRAINT "DigitalFileVersion_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DigitalSubmissionEvent" ADD CONSTRAINT "DigitalSubmissionEvent_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "DigitalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalSubmissionEvent" ADD CONSTRAINT "DigitalSubmissionEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
