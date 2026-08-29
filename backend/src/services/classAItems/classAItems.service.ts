import { ClassAItemType } from '@prisma/client';
import { distance } from 'fastest-levenshtein';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/apiResponse';
import { resolveDateRange } from '../../utils/dateRange';
import { aggregateItemSales } from '../sales/sales.service';

export async function listClassAItems(brand: string) {
  return prisma.classAItem.findMany({ where: { brand }, orderBy: { createdAt: 'asc' } });
}

/** Every item name that actually exists for a brand, across both Sales and Purchase data. */
async function listRealItemNames(brand: string): Promise<string[]> {
  const [saleRows, poRows] = await Promise.all([
    prisma.saleItem.findMany({
      where: { sale: { outlet: { brand } } },
      select: { itemName: true },
      distinct: ['itemName'],
    }),
    prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { outlet: { brand } } },
      select: { itemName: true },
      distinct: ['itemName'],
    }),
  ]);

  const byLower = new Map<string, string>();
  for (const row of [...saleRows, ...poRows]) {
    const name = row.itemName.trim();
    const key = name.toLowerCase();
    if (name && !byLower.has(key)) byLower.set(key, name);
  }
  return Array.from(byLower.values());
}

// Substring hits outrank pure edit distance because real names carry pack-size
// suffixes ("Coke" vs "Coke 300 Ml") that Levenshtein alone scores as very distant.
function suggestNames(input: string, pool: string[], limit = 5): string[] {
  const query = input.trim().toLowerCase();
  if (!query) return [];
  return pool
    .map((name) => {
      const lower = name.toLowerCase();
      return { name, contains: lower.includes(query) || query.includes(lower), dist: distance(query, lower) };
    })
    .sort((a, b) => {
      if (a.contains !== b.contains) return a.contains ? -1 : 1;
      if (a.dist !== b.dist) return a.dist - b.dist;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((r) => r.name);
}

export async function addClassAItem(brand: string, type: ClassAItemType, value: string) {
  let resolved = value.trim();

  // ITEM entries are free text from the admin, and a name that matches nothing real
  // becomes a permanent all-zero reconciliation row that looks identical to a real
  // item that simply hasn't sold. Block it, and offer the closest real names instead.
  if (type === ClassAItemType.ITEM) {
    const realNames = await listRealItemNames(brand);
    const match = realNames.find((n) => n.toLowerCase() === resolved.toLowerCase());
    if (!match) {
      throw new AppError('No item with this name exists in Sales or Purchase data', 400, {
        suggestions: suggestNames(resolved, realNames),
      });
    }
    // Store the real spelling so casing variants can't create duplicate entries.
    resolved = match;
  }

  return prisma.classAItem.upsert({
    where: { brand_type_value: { brand, type, value: resolved } },
    update: {},
    create: { brand, type, value: resolved },
  });
}

export async function removeClassAItem(id: string) {
  await prisma.classAItem.delete({ where: { id } });
}

export interface ClassAItemSummaryRow {
  key: string;
  itemName: string;
  category: string | null;
  quantitySold: number;
  revenue: number;
  averagePrice: number;
}

export async function getClassAItemsSummary(query: {
  brand: string;
  outletId?: string;
  range?: string;
  from?: string;
  to?: string;
}): Promise<ClassAItemSummaryRow[]> {
  const { from, to } = resolveDateRange(query);
  const [entries, aggregate] = await Promise.all([
    listClassAItems(query.brand),
    aggregateItemSales({ outletId: query.outletId, brand: query.brand, from, to }),
  ]);

  const byNameLower = new Map(aggregate.map((r) => [r.itemName.toLowerCase(), r]));
  const rows: ClassAItemSummaryRow[] = [];

  for (const entry of entries) {
    if (entry.type === ClassAItemType.ITEM) {
      const match = byNameLower.get(entry.value.toLowerCase());
      rows.push({
        key: `item:${entry.value}`,
        itemName: entry.value,
        category: match?.category ?? null,
        quantitySold: match?.quantitySold ?? 0,
        revenue: match?.revenue ?? 0,
        averagePrice: match?.averagePrice ?? 0,
      });
    } else {
      const matches = aggregate.filter((r) => r.category?.toLowerCase() === entry.value.toLowerCase());
      for (const m of matches) {
        rows.push({
          key: `category:${entry.value}:${m.itemName}`,
          itemName: m.itemName,
          category: m.category,
          quantitySold: m.quantitySold,
          revenue: m.revenue,
          averagePrice: m.averagePrice,
        });
      }
    }
  }

  return rows;
}
