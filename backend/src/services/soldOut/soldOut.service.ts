import { prisma } from '../../config/db';
import { dateOnlyUtc } from '../../utils/dateRange';
import { parsePagination, toSkipTake, paginationMeta } from '../../utils/pagination';
import { AppError } from '../../utils/apiResponse';

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateParam(value: string | undefined): Date {
  if (!value) {
    const now = new Date();
    return dateOnlyUtc(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new AppError('Invalid date, expected YYYY-MM-DD', 400);
  return dateOnlyUtc(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface SoldOutRowData {
  itemName: string;
  stockDate: string;
  soldQty: number;
  missedQty: number;
  ratio: number | null;
  hasEntry: boolean;
}

export interface SoldOutQuery {
  outletId?: string;
  /** Forced by scopeToBrand for brand-scoped users; ANDs with outletId so a mismatch returns nothing. */
  brand?: string;
  date?: string;
  page?: string;
  pageSize?: string;
}

/**
 * Row universe = union of (a) everything that actually sold at this outlet
 * that day and (b) every item Head Chef has logged missed demand for that
 * day — an item can appear from either side (e.g. sold zero all day because
 * it was out of stock the whole time, but still has missed-demand entries).
 */
export async function getSoldOutDashboard(query: SoldOutQuery) {
  if (!query.outletId) throw new AppError('outletId is required', 400);
  const outletId = query.outletId;
  const day = parseDateParam(query.date);
  const nextDay = new Date(day);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayKey = dayKeyOf(day);

  const [soldRows, entryRows] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ['itemName'],
      where: {
        sale: {
          outletId,
          orderDate: { gte: day, lt: nextDay },
          ...(query.brand ? { outlet: { brand: query.brand } } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    prisma.soldOutEntry.findMany({
      where: { outletId, stockDate: day, ...(query.brand ? { outlet: { brand: query.brand } } : {}) },
    }),
  ]);

  const soldByItem = new Map<string, number>();
  for (const r of soldRows) soldByItem.set(r.itemName, toNum(r._sum.quantity));

  const entryByItem = new Map<string, number>();
  for (const r of entryRows) entryByItem.set(r.itemName, r.missedQty);

  const itemNames = new Set<string>([...soldByItem.keys(), ...entryByItem.keys()]);

  const rows: SoldOutRowData[] = Array.from(itemNames)
    .map((itemName) => {
      const soldQty = soldByItem.get(itemName) ?? 0;
      const missedQty = entryByItem.get(itemName) ?? 0;
      const denom = soldQty + missedQty;
      return {
        itemName,
        stockDate: dayKey,
        soldQty,
        missedQty,
        ratio: denom > 0 ? round2((missedQty / denom) * 100) : null,
        hasEntry: entryByItem.has(itemName),
      };
    })
    .sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) || a.itemName.localeCompare(b.itemName));

  const pagination = parsePagination(query as unknown as Record<string, unknown>);
  const total = rows.length;
  const { skip, take } = toSkipTake(pagination);

  return {
    rows: rows.slice(skip, skip + take),
    meta: paginationMeta(pagination, total),
  };
}

export interface UpsertSoldOutEntryInput {
  outletId: string;
  itemName: string;
  date: string;
  missedQty: number;
  reportedById?: string;
}

export async function upsertSoldOutEntry(input: UpsertSoldOutEntryInput) {
  const day = parseDateParam(input.date);

  return prisma.soldOutEntry.upsert({
    where: { outletId_itemName_stockDate: { outletId: input.outletId, itemName: input.itemName, stockDate: day } },
    create: {
      outletId: input.outletId,
      itemName: input.itemName,
      stockDate: day,
      missedQty: input.missedQty,
      reportedById: input.reportedById,
    },
    update: {
      missedQty: input.missedQty,
      reportedById: input.reportedById,
    },
  });
}
