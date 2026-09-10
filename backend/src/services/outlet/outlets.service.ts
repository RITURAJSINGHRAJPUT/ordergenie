import { prisma } from '../../config/db';
import { resolveDateRange } from '../../utils/dateRange';

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function listOutlets(options: { activeOnly?: boolean; outletId?: string; brand?: string } = {}) {
  const { activeOnly = true, outletId, brand } = options;
  return prisma.outlet.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(outletId ? { id: outletId } : {}),
      ...(brand ? { brand } : {}),
    },
    orderBy: [{ brand: 'asc' }, { name: 'asc' }],
  });
}

export async function getOutletsOverview() {
  const outlets = await prisma.outlet.findMany({ where: { isActive: true }, orderBy: [{ brand: 'asc' }, { name: 'asc' }] });
  const now = new Date();
  const todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTo = new Date(todayFrom);
  todayTo.setDate(todayTo.getDate() + 1);

  return Promise.all(
    outlets.map(async (o) => {
      const [salesAgg, poCount, latestInventoryDates] = await Promise.all([
        prisma.sale.aggregate({
          where: { outletId: o.id, orderDateTime: { gte: todayFrom, lt: todayTo } },
          _sum: { netAmount: true },
          _count: true,
        }),
        prisma.purchaseOrder.count({ where: { outletId: o.id, status: { in: ['PENDING', 'PARTIALLY_RECEIVED', 'DRAFT'] } } }),
        prisma.inventory.groupBy({ by: ['itemName'], where: { outletId: o.id }, _max: { stockDate: true } }),
      ]);

      let inventoryValue = 0;
      if (latestInventoryDates.length > 0) {
        const rows = await prisma.inventory.findMany({
          where: { OR: latestInventoryDates.map((d) => ({ outletId: o.id, itemName: d.itemName, stockDate: d._max.stockDate! })) },
          select: { stockValue: true },
        });
        inventoryValue = rows.reduce((s, r) => s + toNum(r.stockValue), 0);
      }

      return {
        id: o.id,
        name: o.name,
        brand: o.brand,
        rid: o.rid,
        city: o.city,
        outletType: o.outletType,
        todaySales: toNum(salesAgg._sum.netAmount),
        todayOrders: salesAgg._count,
        inventoryValue,
        openPurchaseOrders: poCount,
      };
    })
  );
}

export async function getOutletComparison(query: { range?: string; from?: string; to?: string }) {
  const { from, to } = resolveDateRange(query);
  const periodMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodMs);
  const prevTo = new Date(from.getTime());

  const outlets = await prisma.outlet.findMany({ where: { isActive: true, outletType: 'OUTLET' } });

  return Promise.all(
    outlets.map(async (o) => {
      const [current, previous] = await Promise.all([
        prisma.sale.aggregate({
          where: { outletId: o.id, orderDateTime: { gte: from, lte: to } },
          _sum: { netAmount: true },
          _count: true,
        }),
        prisma.sale.aggregate({
          where: { outletId: o.id, orderDateTime: { gte: prevFrom, lt: prevTo } },
          _sum: { netAmount: true },
        }),
      ]);

      const revenue = toNum(current._sum.netAmount);
      const previousRevenue = toNum(previous._sum.netAmount);
      const growth = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null;

      return {
        id: o.id,
        name: o.name,
        brand: o.brand,
        revenue,
        orders: current._count,
        averageBill: current._count > 0 ? revenue / current._count : 0,
        growthPercent: growth,
      };
    })
  );
}
