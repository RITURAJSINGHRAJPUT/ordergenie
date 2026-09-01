-- AlterTable
ALTER TABLE "PredictedSale" ADD COLUMN "importLogId" TEXT;

-- AddForeignKey
ALTER TABLE "PredictedSale" ADD CONSTRAINT "PredictedSale_importLogId_fkey" FOREIGN KEY ("importLogId") REFERENCES "PredictionImportLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
