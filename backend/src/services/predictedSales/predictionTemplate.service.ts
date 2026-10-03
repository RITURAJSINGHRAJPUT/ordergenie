import { Workbook } from 'exceljs';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/apiResponse';

export const TEMPLATE_HEADERS = ['Outlet', 'Item', 'Date', 'Qty'] as const;

/**
 * The item names worth forecasting for a brand: the Class A Items themselves, nothing else.
 *
 * Recipe ingredients like "Big Pizza Dough" are listed and forecast **directly**. Deriving
 * them instead would mean listing every trigger item, and NAME_CONTAINS fragments ("15 Inch",
 * "11 Inch") match 84 pizza variants for Capiche alone — a template three times the size of
 * the file this replaces. resolvePredictedSales lets an entered ingredient figure win over
 * the derived sum, so one number per day per dough is enough.
 */
export async function forecastItemsForBrand(brand: string): Promise<string[]> {
  const classAItems = await prisma.classAItem.findMany({
    where: { brand, type: 'ITEM' },
    select: { value: true },
  });

  const wanted = new Map<string, string>();
  for (const item of classAItems) {
    const name = item.value.trim();
    const key = name.toLowerCase();
    if (name && !wanted.has(key)) wanted.set(key, name);
  }

  return Array.from(wanted.values()).sort((a, b) => a.localeCompare(b));
}

function daysInMonth(month: string): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new AppError('Invalid month, expected YYYY-MM', 400);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new AppError('Invalid month, expected YYYY-MM', 400);

  const days: string[] = [];
  const cursor = new Date(Date.UTC(year, monthIndex, 1));
  while (cursor.getUTCMonth() === monthIndex) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Excel rejects a sheet name over 31 characters, and two sheets can't share a name. */
function uniqueSheetName(base: string, taken: Set<string>): string {
  const trimmed = base.slice(0, 31);
  let name = trimmed;
  let suffix = 2;
  while (taken.has(name)) name = `${trimmed.slice(0, 28)} ${suffix++}`;
  taken.add(name);
  return name;
}

/**
 * One sheet per outlet, items down the rows and a column per day — the same shape the
 * forecasting tool produces, so a downloaded template and a generated file import by the
 * identical path. Qty cells are left empty: blank means "no forecast" and is skipped, which
 * is deliberately not the same as a 0.
 *
 * Only outlets whose brand has Class A Items get a sheet; the rest have nothing to forecast.
 */
export async function buildPredictionTemplate(month: string): Promise<{ buffer: Buffer; rows: number }> {
  const days = daysInMonth(month);
  const outlets = await prisma.outlet.findMany({
    where: { isActive: true },
    select: { name: true, brand: true },
    orderBy: [{ brand: 'asc' }, { name: 'asc' }],
  });

  const brands = Array.from(new Set(outlets.map((o) => o.brand)));
  const itemsByBrand = new Map<string, string[]>();
  for (const brand of brands) itemsByBrand.set(brand, await forecastItemsForBrand(brand));

  const workbook = new Workbook();
  const takenNames = new Set<string>();
  let rows = 0;

  for (const outlet of outlets) {
    const items = itemsByBrand.get(outlet.brand) ?? [];
    if (items.length === 0) continue;

    const sheet = workbook.addWorksheet(uniqueSheetName(`Prediction - ${outlet.name}`, takenNames));
    sheet.addRow([`${outlet.name} — Sales Forecast (${month})`]).font = { bold: true };
    sheet.addRow([]);

    // Row 3 is the header, matching the forecasting tool's layout exactly.
    const header = sheet.addRow(['Category', 'Item', ...days]);
    header.font = { bold: true };
    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 32;
    for (let i = 0; i < days.length; i++) sheet.getColumn(3 + i).width = 11;
    sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];

    for (const item of items) {
      sheet.addRow(['', item]);
      rows += days.length;
    }
  }

  const notes = workbook.addWorksheet('Notes');
  notes.columns = [{ width: 110 }];
  for (const line of [
    `Sales AI prediction template for ${month}.`,
    '',
    'One sheet per outlet. Fill in the day cells only — leave the Item column exactly as generated.',
    'The Category column is optional and ignored on import; it is there to match the forecast tool\'s layout.',
    '',
    'A blank cell means "no forecast" and is skipped on import. It is NOT the same as 0:',
    'entering 0 tells reconciliation you predict zero sales, which suppresses the 7-day-average fallback.',
    '',
    'Only items reconciliation actually uses are listed. Anything else would be imported and never read.',
    'Pizza dough is forecast directly — enter one total per day. Leave it blank and reconciliation',
    'falls back to summing the individual pizza forecasts, as it did before.',
    '',
    'Re-uploading the same month overwrites the figures for the rows it contains.',
  ]) {
    notes.addRow([line]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), rows };
}
