import { OutletType, PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { resolveDateRange } from '../../utils/dateRange';
import { dateClause } from './purchaseOrders.service';

/**
 * Brands whose outlets order prep rather than produce it. The KG stores, bakeries and prep
 * kitchens are the ones doing the chopping, so counting their own purchases here would mix what
 * the kitchen has to make with what it buys.
 */
const EXCLUDED_BRANDS = ['KG', 'Internal'];

export interface PoLookupRow {
  itemName: string;
  unit: string | null;
  /** outletId -> quantity ordered. Outlets that ordered none are simply absent. */
  byOutlet: Record<string, number>;
  total: number;
}

export interface PoLookupCity {
  city: string;
  outlets: { id: string; name: string }[];
  rows: PoLookupRow[];
}

function toNum(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * What each city's prep kitchen has to produce for a delivery day: every purchase-order item
 * across that city's restaurants, with the per-outlet split and the total.
 *
 * Grouped by (itemName, unit), never itemName alone — `unit` is Petpooja's `lbl_unit` copied
 * verbatim, so the same name legitimately appears as kg in one PO and "Qty" in another, and a
 * total mixing the two would be meaningless.
 */
export async function getPoLookup(date?: string): Promise<PoLookupCity[]> {
  const { from, to } = date ? resolveDateRange({ from: date, to: date }) : resolveDateRange({ range: 'today' });

  const outlets = await prisma.outlet.findMany({
    where: {
      isActive: true,
      outletType: OutletType.OUTLET,
      city: { not: null },
      brand: { notIn: EXCLUDED_BRANDS },
    },
    select: { id: true, name: true, city: true },
    orderBy: { name: 'asc' },
  });
  if (outlets.length === 0) return [];

  const items = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        outletId: { in: outlets.map((o) => o.id) },
        // The same "due today" rule the Purchase Orders lists use, including the fallback for
        // POs that arrive without an expected date.
        ...dateClause('expectedDate', from, to),
        status: { not: PurchaseOrderStatus.CANCELLED },
      },
    },
    select: { itemName: true, unit: true, quantity: true, purchaseOrder: { select: { outletId: true } } },
  });

  const byCity = new Map<string, { outlets: typeof outlets; rows: Map<string, PoLookupRow> }>();
  for (const outlet of outlets) {
    const city = outlet.city as string;
    if (!byCity.has(city)) byCity.set(city, { outlets: [], rows: new Map() });
    byCity.get(city)!.outlets.push(outlet);
  }

  const cityByOutlet = new Map(outlets.map((o) => [o.id, o.city as string]));

  for (const item of items) {
    const city = cityByOutlet.get(item.purchaseOrder.outletId);
    if (!city) continue;

    const itemName = item.itemName.trim();
    if (!itemName) continue;

    // Case-insensitive key so two spellings of one item don't split the prep list, while the
    // first spelling seen is what gets displayed.
    const key = `${itemName.toLowerCase()}|${item.unit ?? ''}`;
    const rows = byCity.get(city)!.rows;
    const row = rows.get(key) ?? { itemName, unit: item.unit, byOutlet: {}, total: 0 };

    const qty = toNum(item.quantity);
    row.byOutlet[item.purchaseOrder.outletId] = (row.byOutlet[item.purchaseOrder.outletId] ?? 0) + qty;
    row.total += qty;
    rows.set(key, row);
  }

  return Array.from(byCity.entries())
    .map(([city, { outlets: cityOutlets, rows }]) => ({
      city,
      outlets: cityOutlets.map((o) => ({ id: o.id, name: o.name })),
      // Biggest prep jobs first — that's the order someone works down the list in.
      rows: Array.from(rows.values()).sort((a, b) => b.total - a.total || a.itemName.localeCompare(b.itemName)),
    }))
    .sort((a, b) => a.city.localeCompare(b.city));
}
