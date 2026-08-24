import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { parsePagination, toSkipTake, paginationMeta } from '../../utils/pagination';
import { resolveDateRange } from '../../utils/dateRange';
import { AppError } from '../../utils/apiResponse';

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export interface PurchaseOrderQuery {
  outletId?: string;
  brand?: string;
  status?: string;
  vendorId?: string;
  range?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
  dateField?: string;
  search?: string;
}

export async function listPurchaseOrders(query: PurchaseOrderQuery) {
  const pagination = parsePagination(query as unknown as Record<string, unknown>);
  const { from, to } = resolveDateRange(query);
  const dateField = query.dateField === 'petpoojaCreatedAt' ? 'petpoojaCreatedAt' : 'orderDate';

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.outletId ? { outletId: query.outletId } : {}),
    ...(query.brand ? { outlet: { brand: query.brand } } : {}),
    ...(query.status ? { status: query.status as PurchaseOrderStatus } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.search ? { poNumber: { contains: query.search, mode: 'insensitive' as const } } : {}),
    [dateField]: { gte: from, lte: to },
  };

  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { outlet: { select: { name: true } }, vendor: { select: { name: true } } },
      orderBy: { orderDate: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    rows: rows.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      vendorName: po.vendor?.name ?? '—',
      outletId: po.outletId,
      outletName: po.outlet.name,
      status: po.status,
      totalAmount: toNum(po.totalAmount),
      orderDate: po.orderDate,
      expectedDate: po.expectedDate,
      petpoojaCreatedAt: po.petpoojaCreatedAt,
    })),
    meta: paginationMeta(pagination, total),
  };
}

export interface PurchaseOrderItemsByDay {
  date: string;
  items: { itemName: string; unit: string | null; quantity: number }[];
}

/**
 * Day-wise, item-wise breakdown across POs — e.g. "23 Aug: Tiramisu 5, Coke 10" —
 * summed from every PurchaseOrderItem whose PO falls in range, not one PO at a time.
 * Grouped by (itemName, unit) rather than itemName alone: the same item can
 * legitimately appear in different units across POs, and summing across units would
 * produce a meaningless total.
 */
export async function listPurchaseOrderItemsByDay(query: PurchaseOrderQuery): Promise<PurchaseOrderItemsByDay[]> {
  const { from, to } = resolveDateRange(query);
  const dateField = query.dateField === 'petpoojaCreatedAt' ? 'petpoojaCreatedAt' : 'orderDate';

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.outletId ? { outletId: query.outletId } : {}),
    ...(query.brand ? { outlet: { brand: query.brand } } : {}),
    ...(query.status ? { status: query.status as PurchaseOrderStatus } : { status: { not: PurchaseOrderStatus.CANCELLED } }),
    [dateField]: { gte: from, lte: to },
  };

  const items = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrder: where },
    select: {
      itemName: true,
      unit: true,
      quantity: true,
      purchaseOrder: { select: { orderDate: true, petpoojaCreatedAt: true } },
    },
  });

  const byDay = new Map<string, Map<string, { itemName: string; unit: string | null; quantity: number }>>();
  for (const item of items) {
    const dateValue = dateField === 'petpoojaCreatedAt' ? item.purchaseOrder.petpoojaCreatedAt : item.purchaseOrder.orderDate;
    if (!dateValue) continue;
    const dayKey = dateValue.toISOString().slice(0, 10);
    const itemKey = `${item.itemName}|${item.unit ?? ''}`;

    if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
    const dayMap = byDay.get(dayKey)!;
    const existing = dayMap.get(itemKey);
    const qty = toNum(item.quantity);
    if (existing) existing.quantity += qty;
    else dayMap.set(itemKey, { itemName: item.itemName, unit: item.unit, quantity: qty });
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, dayMap]) => ({
      date,
      items: Array.from(dayMap.values()).sort((a, b) => b.quantity - a.quantity),
    }));
}

export async function getPurchaseOrderById(id: string, restrictToOutletId?: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { outlet: { select: { name: true } }, vendor: true, items: true },
  });
  if (!po) throw new AppError('Purchase order not found', 404);
  if (restrictToOutletId && po.outletId !== restrictToOutletId) throw new AppError('Purchase order not found', 404);

  return {
    id: po.id,
    poNumber: po.poNumber,
    outletId: po.outletId,
    outletName: po.outlet.name,
    vendor: po.vendor
      ? { id: po.vendor.id, name: po.vendor.name, contactPerson: po.vendor.contactPerson, phone: po.vendor.phone }
      : null,
    invoiceNumber: po.invoiceNumber,
    status: po.status,
    totalAmount: toNum(po.totalAmount),
    taxAmount: toNum(po.taxAmount),
    orderDate: po.orderDate,
    expectedDate: po.expectedDate,
    receivedDate: po.receivedDate,
    items: po.items.map((i) => ({
      itemName: i.itemName,
      quantity: toNum(i.quantity),
      unit: i.unit,
      rate: toNum(i.rate),
      amount: toNum(i.amount),
      cgst: toNum(i.cgst),
      sgst: toNum(i.sgst),
      igst: toNum(i.igst),
      cess: toNum(i.cess),
      receivedQty: toNum(i.receivedQty),
      pendingQty: toNum(i.pendingQty),
    })),
  };
}
