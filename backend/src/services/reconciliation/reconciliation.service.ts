import { Prisma, DataSource, ClassAItemType, RecipeTriggerType, PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { dateOnlyUtc } from '../../utils/dateRange';
import { parsePagination, toSkipTake, paginationMeta } from '../../utils/pagination';
import { AppError } from '../../utils/apiResponse';
import { listClassAItems } from '../classAItems/classAItems.service';

// Fallback used for "predicted sales" when no imported forecast (PredictedSale,
// see scripts/import-predicted-sales.ts) covers this item+day — a plain trailing
// average, not a real model. Missing days count as 0, not excluded.
const PREDICTED_SALES_WINDOW_DAYS = 7;
// Safety margin applied to Sales (AI) regardless of source (imported forecast or
// trailing-average fallback) — the displayed/used prediction is always 15% above
// the raw figure, so everything derived from it (Closing (AI), Sales Variance)
// already reflects the buffer. Replaces the old separate "+15%" column, which
// buffered Next Day Opening instead — the margin now lives on the prediction
// itself rather than tacked onto next-day stock at the end.
const SALES_AI_BUFFER_PCT = 0.15;

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
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

/**
 * The reconciliation ingredient list is whichever Class A Items are selected
 * for this brand: ITEM-type entries map 1:1; CATEGORY-type entries expand to
 * every real sold item whose category *contains* the entry's value (so one
 * "Desserts" entry also catches "Desserts [online]"), each becoming its own
 * row. Returns itemName -> the ClassAItem id responsible for including it
 * (used by the frontend to power a per-row "remove from selection" action).
 * No fallback to "show everything" when the brand has no Class A Items yet —
 * an empty selection means an empty dashboard, by design.
 *
 * Category rows are discovered from ALL history up to (and including) the
 * selected day, not a rolling recent window — once an item has ever sold
 * under a tracked category at this outlet, it keeps showing every day after
 * that (with 0s on days it didn't sell), same as ITEM-type rows. A rolling
 * window would make rows appear/disappear as the selected date changes, which
 * reads as "missing data" rather than "didn't sell that day."
 */
async function getSelectedIngredientUniverse(outletId: string, brand: string, day: Date): Promise<Map<string, string>> {
  const entries = await listClassAItems(brand);
  const map = new Map<string, string>();

  for (const entry of entries) {
    if (entry.type === ClassAItemType.ITEM) {
      map.set(entry.value, entry.id);
    }
  }

  const categoryEntries = entries.filter((e) => e.type === ClassAItemType.CATEGORY);
  if (categoryEntries.length > 0) {
    const items = await prisma.saleItem.findMany({
      where: { sale: { outletId, orderDate: { lte: day } }, category: { not: null } },
      select: { itemName: true, category: true },
      distinct: ['itemName'],
    });
    for (const catEntry of categoryEntries) {
      const needle = catEntry.value.toLowerCase();
      for (const item of items) {
        if (!map.has(item.itemName) && item.category?.toLowerCase().includes(needle)) {
          map.set(item.itemName, catEntry.id);
        }
      }
    }
  }

  return map;
}

interface RecipeRule {
  triggerType: RecipeTriggerType;
  triggerValues: string[];
  qtyPerMatch: number;
}

/** ingredientName -> its matching rules (multiple rules for one ingredient are unioned). */
async function getRecipeRules(brand: string): Promise<Map<string, RecipeRule[]>> {
  const rows = await prisma.reconciliationRecipe.findMany({ where: { brand } });
  const map = new Map<string, RecipeRule[]>();
  for (const r of rows) {
    const rule: RecipeRule = { triggerType: r.triggerType, triggerValues: r.triggerValues, qtyPerMatch: toNum(r.qtyPerMatch) };
    if (!map.has(r.ingredientName)) map.set(r.ingredientName, []);
    map.get(r.ingredientName)!.push(rule);
  }
  return map;
}

function itemMatchesRule(itemName: string, rule: RecipeRule): boolean {
  const lowerItem = itemName.toLowerCase();
  if (rule.triggerType === RecipeTriggerType.ITEM_NAMES) {
    return rule.triggerValues.some((v) => v.toLowerCase() === lowerItem);
  }
  return rule.triggerValues.some((v) => lowerItem.includes(v.toLowerCase()));
}

/**
 * For each derived "recipe" ingredient (e.g. "Big Dough"), synthesizes its
 * per-day sales as the sum of every real item's quantity that matches any of
 * its rules, and injects it into salesByItem under the recipe's ingredient
 * name — so the rest of the pipeline (predicted-sales averaging, salesToday
 * lookup) needs no special-casing, it just reads the map as normal.
 */
function applyRecipesToSalesMap(salesByItem: Map<string, Map<string, number>>, recipesByIngredient: Map<string, RecipeRule[]>): void {
  for (const [ingredientName, rules] of recipesByIngredient) {
    const combined = new Map<string, number>();
    for (const [realItemName, perDay] of salesByItem) {
      const matched = rules.find((r) => itemMatchesRule(realItemName, r));
      if (!matched) continue;
      for (const [day, qty] of perDay) {
        combined.set(day, (combined.get(day) ?? 0) + qty * matched.qtyPerMatch);
      }
    }
    salesByItem.set(ingredientName, combined);
  }
}

/** itemName -> (YYYY-MM-DD -> summed quantity), covering [from, to] inclusive. */
async function getSalesByItemAndDay(outletId: string, from: Date, to: Date): Promise<Map<string, Map<string, number>>> {
  const rows = await prisma.saleItem.findMany({
    where: { sale: { outletId, orderDate: { gte: from, lte: to } } },
    select: { itemName: true, quantity: true, sale: { select: { orderDate: true } } },
  });

  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = dayKeyOf(r.sale.orderDate);
    if (!map.has(r.itemName)) map.set(r.itemName, new Map());
    const inner = map.get(r.itemName)!;
    inner.set(key, (inner.get(key) ?? 0) + toNum(r.quantity));
  }
  return map;
}

/**
 * Real, imported forecast data for exactly this outlet+day (see
 * scripts/import-predicted-sales.ts), keyed by itemName -> predicted qty.
 * Wrapped into the same shape applyRecipesToSalesMap expects (a single day's
 * entry) so Big Dough/Small Dough-style recipes sum imported predictions the
 * same way they sum real sales, with no separate matching logic.
 */
async function getPredictedSalesByItemAndDay(
  outletId: string,
  day: Date,
  dayKey: string,
  recipesByIngredient: Map<string, RecipeRule[]>
): Promise<Map<string, number>> {
  const rows = await prisma.predictedSale.findMany({
    where: { outletId, stockDate: day },
    select: { itemName: true, predictedQty: true },
  });

  const wrapped = new Map<string, Map<string, number>>();
  for (const r of rows) {
    wrapped.set(r.itemName, new Map([[dayKey, toNum(r.predictedQty)]]));
  }
  applyRecipesToSalesMap(wrapped, recipesByIngredient);

  const flat = new Map<string, number>();
  for (const [itemName, perDay] of wrapped) {
    const qty = perDay.get(dayKey);
    if (qty !== undefined) flat.set(itemName, qty);
  }
  return flat;
}

// Attributed by expectedDate (day goods are due to arrive), not orderDate (day the
// PO was placed) — a PO placed today for delivery on the 29th should land in the
// 29th's row, not today's. CANCELLED POs are excluded since they're never arriving;
// every other status (PENDING/PARTIALLY_RECEIVED/RECEIVED) still counts as expected
// stock for that day.
async function getPOByItem(outletId: string, day: Date): Promise<Map<string, number>> {
  const rows = await prisma.purchaseOrderItem.groupBy({
    by: ['itemName'],
    where: {
      purchaseOrder: {
        outletId,
        expectedDate: { gte: day, lt: addDays(day, 1) },
        status: { not: PurchaseOrderStatus.CANCELLED },
      },
    },
    _sum: { quantity: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.itemName, toNum(r._sum.quantity));
  return map;
}

// The same itemName can appear with different units across different POs (see the
// similar caveat in purchaseOrders.service.ts's listPurchaseOrderItemsByDay), so this
// takes the most recent PO's unit per item at this outlet as the source of truth.
async function getUnitFromPO(outletId: string): Promise<Map<string, string | null>> {
  const rows = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrder: { outletId } },
    select: { itemName: true, unit: true },
    orderBy: { purchaseOrder: { orderDate: 'desc' } },
    distinct: ['itemName'],
  });
  return new Map(rows.map((r) => [r.itemName, r.unit]));
}

interface ManualEntry {
  opening: number;
  actualClosing: number;
  unit: string | null;
}

async function getManualEntries(outletId: string, day: Date): Promise<Map<string, ManualEntry>> {
  const rows = await prisma.inventory.findMany({
    where: { outletId, stockDate: day, source: DataSource.MANUAL },
  });
  const map = new Map<string, ManualEntry>();
  for (const r of rows) {
    map.set(r.itemName, { opening: toNum(r.openingStock), actualClosing: toNum(r.closingStock), unit: r.unit });
  }
  return map;
}

export interface ReconciliationRowInputs {
  itemName: string;
  classAItemId: string;
  unit: string | null;
  hasManualEntry: boolean;
  opening: number;
  actualClosing: number;
  salesToday: number;
  predictedSales: number;
  poToday: number;
}

export interface ReconciliationRow extends ReconciliationRowInputs {
  factualClosingAI: number;
  nextDayOpening: number;
  salesVariance: number;
  closingVariance: number;
  derivedWastage: number;
  stockDate: string;
}

/**
 * Pure arithmetic, kept separate from the Prisma queries so the formulas can be
 * reasoned about (and tested) without a database. Mirrors the shrinkage model
 * implied by the user's own wastage formula (opening - sales - actualClosing),
 * which omits purchases — so predicted closing does too, for consistency.
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeReconciliationRow(inputs: ReconciliationRowInputs, stockDate: string): ReconciliationRow {
  const factualClosingAI = inputs.opening - inputs.predictedSales;
  const nextDayOpening = inputs.poToday + inputs.actualClosing;
  const salesVariance = inputs.salesToday - inputs.predictedSales;
  const closingVariance = inputs.actualClosing - factualClosingAI;
  const derivedWastage = inputs.opening - inputs.salesToday - inputs.actualClosing;

  return {
    ...inputs,
    predictedSales: round2(inputs.predictedSales),
    factualClosingAI: round2(factualClosingAI),
    nextDayOpening: round2(nextDayOpening),
    salesVariance: round2(salesVariance),
    closingVariance: round2(closingVariance),
    derivedWastage: round2(derivedWastage),
    stockDate,
  };
}

export interface ReconciliationQuery {
  outletId?: string;
  brand?: string;
  date?: string;
  page?: string;
  pageSize?: string;
}

export async function getReconciliationDashboard(query: ReconciliationQuery) {
  if (!query.outletId) throw new AppError('outletId is required', 400);
  if (!query.brand) throw new AppError('brand is required', 400);
  const outletId = query.outletId;
  const brand = query.brand;
  const day = parseDateParam(query.date);
  const dayKey = dayKeyOf(day);
  const windowStart = addDays(day, -PREDICTED_SALES_WINDOW_DAYS);

  const recipesByIngredient = await getRecipeRules(brand);

  const [universe, salesByItem, poByItem, manualEntries, predictedByItem, unitByItem] = await Promise.all([
    getSelectedIngredientUniverse(outletId, brand, day),
    getSalesByItemAndDay(outletId, windowStart, day),
    getPOByItem(outletId, day),
    getManualEntries(outletId, day),
    getPredictedSalesByItemAndDay(outletId, day, dayKey, recipesByIngredient),
    getUnitFromPO(outletId),
  ]);
  applyRecipesToSalesMap(salesByItem, recipesByIngredient);

  const rows = Array.from(universe.entries())
    .map(([itemName, classAItemId]) => {
      const salesMap = salesByItem.get(itemName);
      const salesToday = salesMap?.get(dayKey) ?? 0;

      const imported = predictedByItem.get(itemName);
      let predictedSales: number;
      if (imported !== undefined) {
        predictedSales = imported;
      } else {
        let predictedSum = 0;
        for (let i = 1; i <= PREDICTED_SALES_WINDOW_DAYS; i++) {
          predictedSum += salesMap?.get(dayKeyOf(addDays(day, -i))) ?? 0;
        }
        predictedSales = predictedSum / PREDICTED_SALES_WINDOW_DAYS;
      }
      predictedSales *= 1 + SALES_AI_BUFFER_PCT;

      const manual = manualEntries.get(itemName);

      return computeReconciliationRow(
        {
          itemName,
          classAItemId,
          unit: unitByItem.get(itemName) ?? manual?.unit ?? null,
          hasManualEntry: Boolean(manual),
          opening: manual?.opening ?? 0,
          actualClosing: manual?.actualClosing ?? 0,
          salesToday,
          predictedSales,
          poToday: poByItem.get(itemName) ?? 0,
        },
        dayKey
      );
    })
    .sort((a, b) => a.itemName.localeCompare(b.itemName));

  const pagination = parsePagination(query as unknown as Record<string, unknown>);
  const total = rows.length;
  const { skip, take } = toSkipTake(pagination);

  return {
    rows: rows.slice(skip, skip + take),
    meta: paginationMeta(pagination, total),
  };
}

export interface UpsertReconciliationEntryInput {
  outletId: string;
  itemName: string;
  unit?: string;
  category?: string;
  date: string;
  opening?: number;
  actualClosing?: number;
}

export async function upsertReconciliationEntry(input: UpsertReconciliationEntryInput) {
  if (input.opening === undefined && input.actualClosing === undefined) {
    throw new AppError('At least one of opening or actualClosing is required', 400);
  }
  const day = parseDateParam(input.date);

  const updateData: Prisma.InventoryUpdateInput = { source: DataSource.MANUAL };
  if (input.opening !== undefined) updateData.openingStock = input.opening;
  if (input.actualClosing !== undefined) {
    updateData.closingStock = input.actualClosing;
    updateData.currentStock = input.actualClosing;
  }
  if (input.unit !== undefined) updateData.unit = input.unit;
  if (input.category !== undefined) updateData.category = input.category;

  return prisma.inventory.upsert({
    where: { outletId_itemName_stockDate: { outletId: input.outletId, itemName: input.itemName, stockDate: day } },
    create: {
      outletId: input.outletId,
      itemName: input.itemName,
      unit: input.unit,
      category: input.category,
      stockDate: day,
      source: DataSource.MANUAL,
      openingStock: input.opening ?? 0,
      closingStock: input.actualClosing ?? 0,
      currentStock: input.actualClosing ?? 0,
    },
    update: updateData,
  });
}
