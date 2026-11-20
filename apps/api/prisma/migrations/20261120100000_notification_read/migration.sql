ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);
CREATE INDEX "Notification_accountId_readAt_idx" ON "Notification"("accountId", "readAt");
