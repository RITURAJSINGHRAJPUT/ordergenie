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

/**
 * A flat Outlet | Item | Date | Qty sheet, pre-filled with every row that matters for the
 * month and Qty left blank. Flat rather than a grid so a month of figures can be pasted in
 * one block from whatever produced them.
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
  const sheet = workbook.addWorksheet('Predictions');
  sheet.columns = [
    { header: 'Outlet', key: 'outlet', width: 24 },
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Qty', key: 'qty', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  let rows = 0;
  for (const outlet of outlets) {
    for (const item of itemsByBrand.get(outlet.brand) ?? []) {
      for (const date of days) {
        sheet.addRow({ outlet: outlet.name, item, date, qty: null });
        rows += 1;
      }
    }
  }

  const notes = workbook.addWorksheet('Notes');
  notes.columns = [{ width: 110 }];
  for (const line of [
    `Sales AI prediction template for ${month}.`,
    '',
    'Fill in the Qty column only — leave Outlet, Item and Date exactly as generated.',
    'A blank Qty means "no forecast" and is skipped on import. It is NOT the same as 0:',
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
