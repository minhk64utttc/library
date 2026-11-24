CREATE TABLE "IncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncidentAttachment_storageKey_key" ON "IncidentAttachment"("storageKey");
CREATE INDEX "IncidentAttachment_incidentId_createdAt_idx" ON "IncidentAttachment"("incidentId", "createdAt");

ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_incidentId_fkey"
    FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_uploaderId_fkey"
    FOREIGN KEY ("uploaderId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
