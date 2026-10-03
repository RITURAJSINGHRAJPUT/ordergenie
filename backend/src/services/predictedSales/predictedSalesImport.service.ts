import { Workbook } from 'exceljs';
import { SyncStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { parsePagination, toSkipTake, paginationMeta } from '../../utils/pagination';
import { AppError } from '../../utils/apiResponse';

// Sheet name -> outlet rid. Sheet names reflect the outlet names at the time the
// forecast was built, which may no longer match the live Outlet.name (e.g. "Capiche
// Ahmedabad" / "Capiche Ahmedabad 2.0" were later renamed) — rid is the stable key.
// Moved here unchanged from the original CLI-only script (scripts/import-predicted-sales.ts),
// which now just reads a file into a buffer and calls parseAndImportPredictionWorkbook below.
const SHEET_TO_RID: Record<string, string> = {
  'Capiche Piplod': '21492',
  'Capiche Vesu': '344447',
  'Capiche Ahmedabad': '353369',
  'Capiche Ahmedabad 2.0': '419174',
  'Dessert - Capiche Piplod': '21492',
  'Dessert - Capiche Vesu': '344447',
  'Dessert - Capiche Ahmedabad': '353369',
  'Dessert - Capiche Ahmedabad 2.0': '419174',
  'Dessert - Aiko Surat': '73492',
  'Dessert - Aiko Ahmedabad': '134691',
  'Sushi - Aiko Surat': '73492',
  'Sushi - Aiko Ahmedabad': '134691',
  'Dimsum - Aiko Surat': '73492',
  'Dimsum - Aiko Ahmedabad': '134691',
  'Noodles - Aiko Surat': '73492',
  'Noodles - Aiko Ahmedabad': '134691',
};

const SKIP_COLUMNS = new Set(['Date', 'Day', 'Event', 'Source', 'Total Items']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEADER_ROW = 4;

interface PendingUpsert {
  outletId: string;
  itemName: string;
  stockDate: string;
  predictedQty: number;
  source: string;
  importLogId: string;
}

export interface SkippedSheet {
  sheet: string;
  reason: string;
}

export interface PredictionImportResult {
  logId: string;
  status: SyncStatus;
  rowsCreated: number;
  rowsUpdated: number;
  sheetsProcessed: number;
  sheetsSkipped: SkippedSheet[];
  errorMessage: string | null;
}

function cellDateString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value ?? '');
  return DATE_RE.test(str) ? str : null;
}

function keyOf(outletId: string, itemName: string, stockDate: string): string {
  return `${outletId}|${itemName}|${stockDate}`;
}

/**
 * Writes pending rows with a create/update split, without one query per row: fetches
 * the existing (outletId, itemName, stockDate) keys already in range up front, then
 * classifies each pending row against that set (updating the set as it writes new
 * ones, so duplicate rows within the same workbook — e.g. two sheets for the same
 * outlet+date — still count correctly).
 */
async function chunkedUpsert(rows: PendingUpsert[]): Promise<{ created: number; updated: number }> {
  if (rows.length === 0) return { created: 0, updated: 0 };

  const outletIds = [...new Set(rows.map((r) => r.outletId))];
  const dates = rows.map((r) => r.stockDate).sort();
  const minDate = new Date(dates[0]);
  const maxDate = new Date(dates[dates.length - 1]);

  const existing = await prisma.predictedSale.findMany({
    where: { outletId: { in: outletIds }, stockDate: { gte: minDate, lte: maxDate } },
    select: { outletId: true, itemName: true, stockDate: true },
  });
  const existingKeys = new Set(
    existing.map((e) => keyOf(e.outletId, e.itemName, e.stockDate.toISOString().slice(0, 10)))
  );

  let created = 0;
  let updated = 0;
  const batchSize = 10;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await Promise.all(
      batch.map((r) => {
        const key = keyOf(r.outletId, r.itemName, r.stockDate);
        if (existingKeys.has(key)) updated++;
        else {
          created++;
          existingKeys.add(key);
        }
        return prisma.predictedSale.upsert({
          where: { outletId_itemName_stockDate: { outletId: r.outletId, itemName: r.itemName, stockDate: new Date(r.stockDate) } },
          create: {
            outletId: r.outletId,
            itemName: r.itemName,
            stockDate: new Date(r.stockDate),
            predictedQty: r.predictedQty,
            source: r.source,
            importLogId: r.importLogId,
          },
          update: { predictedQty: r.predictedQty, source: r.source, importLogId: r.importLogId },
        });
      })
    );
  }
  return { created, updated };
}

/**
 * Parses a forecast workbook (in memory) and upserts it into PredictedSale, logging
 * the run as a PredictionImportLog row (RUNNING -> SUCCESS/PARTIAL/FAILED) the same
 * way syncRunner.service.ts logs SyncLog rows for Petpooja syncs.
 */
/** Shared tail for both formats: upsert, stamp the log, and shape the result. */
async function persistPending(
  rows: PendingUpsert[],
  logId: string,
  sheetsSkipped: SkippedSheet[],
  sheetsProcessed: number
): Promise<PredictionImportResult> {
  const { created, updated } = await chunkedUpsert(rows);
  const status = sheetsSkipped.length > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS;

  await prisma.predictionImportLog.update({
    where: { id: logId },
    data: { status, completedAt: new Date(), rowsCreated: created, rowsUpdated: updated, sheetsProcessed, sheetsSkipped: sheetsSkipped as object },
  });

  return { logId, status, rowsCreated: created, rowsUpdated: updated, sheetsProcessed, sheetsSkipped, errorMessage: null };
}

// The grid workbook names its sheets after the outlet as the forecasting tool knows it, which
// is neither the live Outlet.name nor a rid. Keyed by the sheet label with any "Prediction - "
// prefix stripped; sheets named after a real outlet resolve by name instead and need no entry.
const GRID_SHEET_TO_RID: Record<string, string> = {
  piplod: '21492',
  vesu: '344447',
  ahmedabad: '353369',
  'ahmedabad 2.0': '419174',
  'aiko surat': '73492',
  'aiko ahmedabad': '134691',
};

const GRID_HEADER_SEARCH_ROWS = 5;
/** Row whose daily cells are column sums, not a forecast. */
const GRID_TOTAL_CATEGORY = 'total';

/** The number behind a cell, unwrapping the formula cells Excel stores for computed columns. */
function cellNumber(value: unknown): number | null {
  const raw = value && typeof value === 'object' && 'result' in value ? (value as { result: unknown }).result : value;
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  // "n/a" marks an item forecast monthly only — no daily figure exists to store.
  if (text === '' || text.toLowerCase() === 'n/a') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function gridHeaderRow(sheet: ReturnType<Workbook['getWorksheet']>): number | null {
  if (!sheet) return null;
  for (let rowNumber = 1; rowNumber <= Math.min(GRID_HEADER_SEARCH_ROWS, sheet.rowCount); rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const first = String(row.getCell(1).value ?? '').trim().toLowerCase();
    const second = String(row.getCell(2).value ?? '').trim().toLowerCase();
    const looksLikeHeader = (first === 'category' && second === 'item') || first === 'item';
    if (!looksLikeHeader) continue;
    // A header with no date columns is some other table that happens to start with "Item".
    for (let col = 2; col <= row.cellCount; col++) {
      if (cellDateString(row.getCell(col).value)) return rowNumber;
    }
  }
  return null;
}

/** True when the workbook is the per-outlet grid: items down the rows, dates across the columns. */
function isGridTemplate(workbook: Workbook): boolean {
  return workbook.worksheets.some((sheet) => gridHeaderRow(sheet) !== null);
}

/**
 * Grid parser — one sheet per outlet, one row per item, one column per day.
 *
 * A blank or "n/a" cell is skipped rather than stored as 0, for the same reason the flat
 * template skips a blank Qty: 0 means "we predict none", which suppresses reconciliation's
 * 7-day-average fallback, and that is not what an empty cell means.
 */
async function parseGridTemplate(
  workbook: Workbook,
  fileName: string,
  logId: string,
  skipped: SkippedSheet[]
): Promise<{ pending: PendingUpsert[]; sheetsProcessed: number }> {
  const outlets = await prisma.outlet.findMany({ select: { id: true, name: true, rid: true } });
  const byName = new Map(outlets.map((o) => [o.name.trim().toLowerCase(), o.id]));
  const byRid = new Map(outlets.map((o) => [o.rid, o.id]));

  // Keyed, not appended: an item can be listed twice on one sheet under different menu
  // categories (Aiko's "Jasmine Tea" is in both Drinks and Chumma Chinese), and sales come
  // through under the one name — so the day's figures are summed rather than overwritten.
  const byKey = new Map<string, PendingUpsert>();
  let sheetsProcessed = 0;

  for (const sheet of workbook.worksheets) {
    const headerRowNumber = gridHeaderRow(sheet);
    if (headerRowNumber === null) continue;

    const label = sheet.name.replace(/^\s*prediction\s*-\s*/i, '').trim().toLowerCase();
    const outletId = byName.get(label) ?? byRid.get(GRID_SHEET_TO_RID[label] ?? '') ?? byName.get(sheet.name.trim().toLowerCase());
    if (!outletId) {
      skipped.push({ sheet: sheet.name, reason: 'No outlet matches this sheet name' });
      continue;
    }

    const headerRow = sheet.getRow(headerRowNumber);
    const dateColumns: { index: number; stockDate: string }[] = [];
    // From column 2 so a sheet without the Category column still has its dates found.
    for (let col = 2; col <= headerRow.cellCount; col++) {
      const stockDate = cellDateString(headerRow.getCell(col).value);
      if (stockDate) dateColumns.push({ index: col, stockDate });
    }
    if (dateColumns.length === 0) {
      skipped.push({ sheet: sheet.name, reason: 'No date columns found in the header row' });
      continue;
    }

    const itemColumn = String(headerRow.getCell(1).value ?? '').trim().toLowerCase() === 'item' ? 1 : 2;

    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      if (String(row.getCell(1).value ?? '').trim().toLowerCase() === GRID_TOTAL_CATEGORY) continue;

      const itemName = String(row.getCell(itemColumn).value ?? '').trim();
      if (!itemName) continue;

      for (const { index, stockDate } of dateColumns) {
        const predictedQty = cellNumber(row.getCell(index).value);
        if (predictedQty === null) continue;

        const key = keyOf(outletId, itemName, stockDate);
        const existing = byKey.get(key);
        if (existing) existing.predictedQty += predictedQty;
        else byKey.set(key, { outletId, itemName, stockDate, predictedQty, source: fileName, importLogId: logId });
      }
    }

    sheetsProcessed++;
  }

  return { pending: Array.from(byKey.values()), sheetsProcessed };
}

/** True when the workbook is the flat Outlet | Item | Date | Qty template. */
function isFlatTemplate(workbook: Workbook): boolean {
  const sheet = workbook.getWorksheet('Predictions') ?? workbook.worksheets[0];
  if (!sheet) return false;
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value ?? '').trim().toLowerCase()));
  return ['outlet', 'item', 'date', 'qty'].every((h) => headers.includes(h));
}

/**
 * Flat template parser. One row per figure, so a month can be pasted in a single block.
 *
 * A blank Qty is skipped rather than stored as 0 — a stored 0 would read as "we predict zero
 * sales" and suppress reconciliation's 7-day-average fallback, which is not the same thing as
 * "no forecast given".
 */
async function parseFlatTemplate(
  workbook: Workbook,
  fileName: string,
  logId: string,
  skipped: SkippedSheet[]
): Promise<PendingUpsert[]> {
  const sheet = workbook.getWorksheet('Predictions') ?? workbook.worksheets[0]!;
  const outlets = await prisma.outlet.findMany({ select: { id: true, name: true, rid: true } });
  const byName = new Map(outlets.map((o) => [o.name.trim().toLowerCase(), o.id]));
  const byRid = new Map(outlets.map((o) => [o.rid, o.id]));

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => headers.set(String(cell.value ?? '').trim().toLowerCase(), col));
  const col = (name: string) => headers.get(name)!;

  const pending: PendingUpsert[] = [];
  const unknownOutlets = new Set<string>();
  let badDates = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const qtyRaw = row.getCell(col('qty')).value;
    if (qtyRaw === null || qtyRaw === undefined || String(qtyRaw).trim() === '') return;
    const predictedQty = Number(qtyRaw);
    if (!Number.isFinite(predictedQty)) return;

    const outletLabel = String(row.getCell(col('outlet')).value ?? '').trim();
    const outletId = byName.get(outletLabel.toLowerCase()) ?? byRid.get(outletLabel);
    if (!outletId) {
      if (outletLabel) unknownOutlets.add(outletLabel);
      return;
    }

    const itemName = String(row.getCell(col('item')).value ?? '').trim();
    if (!itemName) return;

    const stockDate = cellDateString(row.getCell(col('date')).value);
    if (!stockDate) {
      badDates += 1;
      return;
    }

    pending.push({ outletId, itemName, stockDate, predictedQty, source: fileName, importLogId: logId });
  });

  for (const name of unknownOutlets) skipped.push({ sheet: name, reason: 'No active outlet with this name' });
  if (badDates > 0) skipped.push({ sheet: sheet.name, reason: `${badDates} row(s) had an unreadable Date` });

  return pending;
}

export async function parseAndImportPredictionWorkbook(
  buffer: Buffer,
  fileName: string,
  triggeredByUserId?: string
): Promise<PredictionImportResult> {
  const log = await prisma.predictionImportLog.create({
    data: { fileName, status: SyncStatus.RUNNING, triggeredByUserId },
  });

  const sheetsSkipped: SkippedSheet[] = [];
  let sheetsProcessed = 0;

  try {
    const workbook = new Workbook();
    // multer's Buffer type and exceljs's declared Buffer param resolve to distinct
    // nominal types under this repo's @types/node setup despite being the same
    // runtime value — `as unknown as Buffer` doesn't satisfy the checker here, so
    // this drops to `any` at the call site only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    // The lean template and the original 16-sheet workbook are both accepted, so historical
    // files still re-import and there's no flag day where an old one silently fails.
    if (isFlatTemplate(workbook)) {
      const pending = await parseFlatTemplate(workbook, fileName, log.id, sheetsSkipped);
      return await persistPending(pending, log.id, sheetsSkipped, 1);
    }

    // Checked after the flat template because that one is identified by an exact header, while
    // the grid check is a shape test that a flat sheet could in principle also satisfy.
    if (isGridTemplate(workbook)) {
      const { pending, sheetsProcessed: gridSheets } = await parseGridTemplate(workbook, fileName, log.id, sheetsSkipped);
      return await persistPending(pending, log.id, sheetsSkipped, gridSheets);
    }

    const outlets = await prisma.outlet.findMany({ where: { rid: { in: Object.values(SHEET_TO_RID) } } });
    const ridToOutletId = new Map(outlets.map((o) => [o.rid, o.id]));

    const pending: PendingUpsert[] = [];

    for (const [sheetName, rid] of Object.entries(SHEET_TO_RID)) {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        sheetsSkipped.push({ sheet: sheetName, reason: 'Sheet not found in workbook' });
        continue;
      }
      const outletId = ridToOutletId.get(rid);
      if (!outletId) {
        sheetsSkipped.push({ sheet: sheetName, reason: `No outlet configured with rid "${rid}"` });
        continue;
      }

      const headerRow = worksheet.getRow(HEADER_ROW);
      const columns: { index: number; itemName: string }[] = [];
      headerRow.eachCell((cell, colNumber) => {
        const label = String(cell.value ?? '').trim();
        if (label && !SKIP_COLUMNS.has(label)) {
          columns.push({ index: colNumber, itemName: label });
        }
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= HEADER_ROW) return;
        const dateStr = cellDateString(row.getCell(1).value);
        if (!dateStr) return; // skips the TOTAL row and any blank rows

        for (const col of columns) {
          const raw = row.getCell(col.index).value;
          const qty = typeof raw === 'number' ? raw : Number(raw ?? 0);
          pending.push({ outletId, itemName: col.itemName, stockDate: dateStr, predictedQty: qty, source: fileName, importLogId: log.id });
        }
      });
      sheetsProcessed++;
    }

    if (sheetsProcessed === 0) {
      const errorMessage = 'No recognized sheets found in this workbook — check it matches the expected forecast format.';
      await prisma.predictionImportLog.update({
        where: { id: log.id },
        data: { status: SyncStatus.FAILED, completedAt: new Date(), sheetsSkipped: sheetsSkipped as object, errorMessage },
      });
      return { logId: log.id, status: SyncStatus.FAILED, rowsCreated: 0, rowsUpdated: 0, sheetsProcessed: 0, sheetsSkipped, errorMessage };
    }

    return await persistPending(pending, log.id, sheetsSkipped, sheetsProcessed);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.predictionImportLog.update({
      where: { id: log.id },
      data: { status: SyncStatus.FAILED, completedAt: new Date(), sheetsSkipped: sheetsSkipped as object, errorMessage },
    });
    return { logId: log.id, status: SyncStatus.FAILED, rowsCreated: 0, rowsUpdated: 0, sheetsProcessed, sheetsSkipped, errorMessage };
  }
}

export interface PredictionSummary {
  totalRows: number;
  minStockDate: string | null;
  maxStockDate: string | null;
  sources: string[];
}

export async function getPredictionSummary(): Promise<PredictionSummary> {
  const [totalRows, range, sources] = await Promise.all([
    prisma.predictedSale.count(),
    prisma.predictedSale.aggregate({ _min: { stockDate: true }, _max: { stockDate: true } }),
    prisma.predictedSale.findMany({ distinct: ['source'], select: { source: true } }),
  ]);

  return {
    totalRows,
    minStockDate: range._min.stockDate ? range._min.stockDate.toISOString().slice(0, 10) : null,
    maxStockDate: range._max.stockDate ? range._max.stockDate.toISOString().slice(0, 10) : null,
    sources: sources.map((s) => s.source),
  };
}

export interface PredictionImportLogQuery {
  page?: string;
  pageSize?: string;
}

export async function listPredictionImportLogs(query: PredictionImportLogQuery) {
  const pagination = parsePagination(query as unknown as Record<string, unknown>);

  const [rows, total] = await Promise.all([
    prisma.predictionImportLog.findMany({
      include: { triggeredByUser: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.predictionImportLog.count(),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      rowsCreated: r.rowsCreated,
      rowsUpdated: r.rowsUpdated,
      sheetsProcessed: r.sheetsProcessed,
      sheetsSkipped: (r.sheetsSkipped as SkippedSheet[] | null) ?? [],
      errorMessage: r.errorMessage,
      triggeredByName: r.triggeredByUser?.name ?? null,
    })),
    meta: paginationMeta(pagination, total),
  };
}

/**
 * Deletes an import log and every PredictedSale row still linked to it (via
 * importLogId, cascaded at the DB level). Imports from before that link existed
 * have no linked rows, so deleting one of those just removes the log entry —
 * there's no way to know which rows an untracked import touched.
 */
export async function deletePredictionImport(id: string) {
  const log = await prisma.predictionImportLog.findUnique({ where: { id } });
  if (!log) throw new AppError('Import log not found', 404);

  const rowsDeleted = await prisma.predictedSale.count({ where: { importLogId: id } });
  await prisma.predictionImportLog.delete({ where: { id } });
  return { rowsDeleted };
}
