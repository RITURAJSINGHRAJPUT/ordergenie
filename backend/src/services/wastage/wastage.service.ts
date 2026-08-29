import { Prisma, WastageReason } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/apiResponse';
import { resolveDateRange } from '../../utils/dateRange';
import { parsePagination, toSkipTake, paginationMeta } from '../../utils/pagination';

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export interface WastageQuery {
  outletId?: string;
  brand?: string;
  range?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
}

export async function listWastageEntries(query: WastageQuery) {
  const { from, to } = resolveDateRange(query);
  const pagination = parsePagination(query as unknown as Record<string, unknown>);

  const where: Prisma.WastageEntryWhereInput = {
    wastageDate: { gte: from, lte: to },
    ...(query.outletId ? { outletId: query.outletId } : {}),
    ...(query.brand ? { outlet: { brand: query.brand } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.wastageEntry.findMany({
      where,
      include: { outlet: { select: { name: true } }, reportedBy: { select: { name: true } } },
      orderBy: { wastageDate: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.wastageEntry.count({ where }),
  ]);

  return {
    rows: rows.map((w) => ({
      id: w.id,
      outletId: w.outletId,
      outletName: w.outlet.name,
      itemName: w.itemName,
      category: w.category,
      quantity: toNum(w.quantity),
      unit: w.unit,
      reason: w.reason,
      notes: w.notes,
      reportedByName: w.reportedBy?.name ?? null,
      wastageDate: w.wastageDate,
    })),
    meta: paginationMeta(pagination, total),
  };
}

export interface CreateWastageInput {
  outletId: string;
  itemName: string;
  category?: string;
  quantity: number;
  unit?: string;
  reason: WastageReason;
  notes?: string;
  reportedById?: string;
}

export async function createWastageEntry(input: CreateWastageInput) {
  return prisma.wastageEntry.create({
    data: {
      outletId: input.outletId,
      itemName: input.itemName,
      category: input.category,
      quantity: input.quantity,
      unit: input.unit,
      reason: input.reason,
      notes: input.notes,
      reportedById: input.reportedById,
    },
  });
}

export async function deleteWastageEntry(id: string, restrictToOutletId?: string): Promise<void> {
  // Deleting by bare id would let an outlet-scoped caller remove another outlet's
  // record — the id is guessable from any list response they've been shown.
  const entry = await prisma.wastageEntry.findUnique({ where: { id } });
  if (!entry) throw new AppError('Wastage entry not found', 404);
  if (restrictToOutletId && entry.outletId !== restrictToOutletId) {
    throw new AppError('Wastage entry not found', 404);
  }
  await prisma.wastageEntry.delete({ where: { id } });
}
