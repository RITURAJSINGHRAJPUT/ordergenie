import { prisma } from '../../config/db';
import { dateOnlyUtc } from '../../utils/dateRange';
import { parsePagination, toSkipTake, paginationMeta } from '../../utils/pagination';
import { AppError } from '../../utils/apiResponse';

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function parseDateParam(value: string, label: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) throw new AppError(`Invalid ${label}, expected YYYY-MM-DD`, 400);
  return dateOnlyUtc(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export interface PredictedSalesQuery {
  outletId?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
  /** Forced by scopeToBrand for brand-scoped users. */
  brand?: string;
}

export async function listPredictedSales(query: PredictedSalesQuery) {
  if (!query.outletId) throw new AppError('outletId is required', 400);
  if (!query.from || !query.to) throw new AppError('from and to are required', 400);

  const outletId = query.outletId;
  const from = parseDateParam(query.from, 'from');
  const to = parseDateParam(query.to, 'to');

  const pagination = parsePagination(query as unknown as Record<string, unknown>);
  const { skip, take } = toSkipTake(pagination);

  const where = {
    outletId,
    stockDate: { gte: from, lte: to },
    // Forced by scopeToBrand — ANDs with outletId so another brand's outlet returns nothing.
    ...(query.brand ? { outlet: { brand: query.brand } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.predictedSale.findMany({
      where,
      orderBy: [{ stockDate: 'asc' }, { itemName: 'asc' }],
      skip,
      take,
    }),
    prisma.predictedSale.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      itemName: r.itemName,
      stockDate: r.stockDate.toISOString().slice(0, 10),
      predictedQty: toNum(r.predictedQty),
      source: r.source,
    })),
    meta: paginationMeta(pagination, total),
  };
}
