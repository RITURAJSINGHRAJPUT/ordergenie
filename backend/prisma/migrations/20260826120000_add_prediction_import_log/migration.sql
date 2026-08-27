-- CreateTable
CREATE TABLE "PredictionImportLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rowsCreated" INTEGER NOT NULL DEFAULT 0,
    "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "sheetsProcessed" INTEGER NOT NULL DEFAULT 0,
    "sheetsSkipped" JSONB,
    "errorMessage" TEXT,
    "triggeredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionImportLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PredictionImportLog" ADD CONSTRAINT "PredictionImportLog_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
