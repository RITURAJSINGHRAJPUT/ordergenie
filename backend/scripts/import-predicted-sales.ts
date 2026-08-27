/**
 * Imports a day-wise sales forecast workbook (like assets/Aug_2026_Final_Prediction_v14.xlsx)
 * into PredictedSale. Reusable — re-run against an updated forecast file to refresh the data;
 * upserts on (outletId, itemName, stockDate) so re-imports overwrite rather than duplicate.
 *
 * Thin CLI wrapper — the actual parsing/upsert logic lives in
 * src/services/predictedSales/predictedSalesImport.service.ts, shared with the
 * Settings > Sales Forecast upload endpoint so both paths stay in sync.
 *
 * Usage: npx tsx scripts/import-predicted-sales.ts <path-to-xlsx>
 */
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../src/config/db';
import { parseAndImportPredictionWorkbook } from '../src/services/predictedSales/predictedSalesImport.service';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-predicted-sales.ts <path-to-xlsx>');
    process.exit(1);
  }

  const buffer = await fs.readFile(filePath);
  const result = await parseAndImportPredictionWorkbook(buffer, path.basename(filePath));

  for (const skipped of result.sheetsSkipped) {
    console.warn(`Skipped sheet "${skipped.sheet}": ${skipped.reason}`);
  }
  console.log(`Status: ${result.status}`);
  console.log(`Sheets processed: ${result.sheetsProcessed}`);
  console.log(`Rows created: ${result.rowsCreated}, updated: ${result.rowsUpdated}`);
  if (result.errorMessage) console.error(`Error: ${result.errorMessage}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
