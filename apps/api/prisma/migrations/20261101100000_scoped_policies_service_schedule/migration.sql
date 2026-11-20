ALTER TABLE "Profile"
  ADD COLUMN "readerGroup" TEXT NOT NULL DEFAULT 'student';

ALTER TABLE "PolicyVersion"
  ADD COLUMN "readerGroup" TEXT,
  ADD COLUMN "materialType" TEXT,
  ADD COLUMN "branchCode" TEXT,
  ADD COLUMN "serviceOpenDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  ADD COLUMN "serviceOpensAt" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN "serviceClosesAt" TEXT NOT NULL DEFAULT '17:00';
