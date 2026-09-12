import { Prisma, DataSource, ClassAItemType, RecipeTriggerType, PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { dateOnlyUtc } from '../../utils/dateRange';
import { parsePagination, toSkipTake, paginationMeta } from '../../utils/pagination';
import { AppError } from '../../utils/apiResponse';
import { listClassAItems, listPurchaseAliases } from '../classAItems/classAItems.service';

// Fallback used for "predicted sales" when no imported forecast (PredictedSale,
// see scripts/import-predicted-sales.ts) covers this item+day — a plain trailing
// average, not a real model. Missing days count as 0, not excluded.
const PREDICTED_SALES_WINDOW_DAYS = 7;
// Safety margin applied to Sales (AI) regardless of source (imported forecast or
// trailing-average fallback) — the displayed prediction is always 15% above the
// raw figure. Since Closing (AI) switched to actual sales, Sales Variance is now
// the only figure this buffer reaches.
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
/**
 * Re-keys raw PO quantities from PO item names onto ingredient names, folding aliases in.
 * Resolved once so the row's PO column and the Opening carry-forward can't disagree.
 */
function resolvePoByIngredient(
  itemNames: Iterable<string>,
  aliases: Map<string, string[]>,
  poByItem: Map<string, number>
): Map<string, number> {
  const resolved = new Map<string, number>();
  for (const itemName of itemNames) {
    let total = poByItem.get(itemName) ?? 0;
    for (const alias of aliases.get(itemName) ?? []) total += poByItem.get(alias) ?? 0;
    if (total !== 0) resolved.set(itemName, total);
  }
  return resolved;
}

function buildIngredientUniverse(
  entries: Awaited<ReturnType<typeof listClassAItems>>,
  categorySoldItems: { itemName: string; category: string | null }[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const entry of entries) {
    if (entry.type === ClassAItemType.ITEM) {
      map.set(entry.value, entry.id);
    }
  }

  for (const catEntry of entries.filter((e) => e.type === ClassAItemType.CATEGORY)) {
    const needle = catEntry.value.toLowerCase();
    for (const item of categorySoldItems) {
      if (!map.has(item.itemName) && item.category?.toLowerCase().includes(needle)) {
        map.set(item.itemName, catEntry.id);
      }
    }
  }

  return map;
}

/**
 * Distinct sold items with a category, for expanding CATEGORY-type Class A entries.
 * Issued unconditionally so it can sit in the same parallel batch as everything else —
 * the round-trip to a remote database costs far more than the occasional wasted query
 * for a brand that tracks no categories.
 */
function getCategorySoldItems(outletId: string, day: Date) {
  return prisma.saleItem.findMany({
    where: { sale: { outletId, orderDate: { lte: day } }, category: { not: null } },
    select: { itemName: true, category: true },
    distinct: ['itemName'],
  });
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

/**
 * itemName -> (YYYY-MM-DD -> summed quantity), covering [from, to] inclusive.
 *
 * Raw SQL rather than a nested `select`, for two reasons: reading orderDate through the
 * relation makes Prisma issue a second query against Sale (a whole extra round-trip), and
 * grouping in Postgres returns one row per item-day instead of every individual line item.
 * `to_char` formats the day key server-side so a `date` column can't drift a day through
 * JS timezone conversion.
 */
async function getSalesByItemAndDay(outletId: string, from: Date, to: Date): Promise<Map<string, Map<string, number>>> {
  const rows = await prisma.$queryRaw<{ itemName: string; day: string; qty: Prisma.Decimal }[]>`
    SELECT si."itemName" AS "itemName",
           to_char(s."orderDate", 'YYYY-MM-DD') AS day,
           SUM(si.quantity) AS qty
    FROM "SaleItem" si
    JOIN "Sale" s ON s.id = si."saleId"
    WHERE s."outletId" = ${outletId}
      AND s."orderDate" >= ${from}
      AND s."orderDate" <= ${to}
    GROUP BY si."itemName", to_char(s."orderDate", 'YYYY-MM-DD')
  `;

  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!map.has(r.itemName)) map.set(r.itemName, new Map());
    map.get(r.itemName)!.set(r.day, toNum(r.qty));
  }
  return map;
}

/**
 * Real, imported forecast data for exactly this outlet+day (see
 * scripts/import-predicted-sales.ts), keyed by itemName -> predicted qty.
 */
function getPredictedSalesRows(outletId: string, day: Date) {
  return prisma.predictedSale.findMany({
    where: { outletId, stockDate: day },
    select: { itemName: true, predictedQty: true },
  });
}

/**
 * Applied after the fetch rather than inside it, so the recipe rules don't have to be
 * awaited before the main batch can start — that ordering cost a whole serial round-trip.
 * Wrapping into the shape applyRecipesToSalesMap expects (a single day's entry) lets
 * Big Dough/Small Dough-style recipes sum imported predictions exactly the way they sum
 * real sales, with no separate matching logic.
 */
function resolvePredictedSales(
  rows: { itemName: string; predictedQty: Prisma.Decimal }[],
  dayKey: string,
  recipesByIngredient: Map<string, RecipeRule[]>
): Map<string, number> {
  const wrapped = new Map<string, Map<string, number>>();
  for (const r of rows) {
    wrapped.set(r.itemName, new Map([[dayKey, toNum(r.predictedQty)]]));
  }

  // A forecast entered against an ingredient name wins over the derived sum. Deriving
  // "Big Pizza Dough" needs a figure for all 84 pizza variants that trigger it, which no
  // one is going to fill in; one dough total per day is what the template asks for. The
  // derived sum still applies whenever nothing was entered — and real *sales* are untouched,
  // since those carry the actual pizza names.
  const explicit = new Map<string, number>();
  for (const ingredientName of recipesByIngredient.keys()) {
    const entered = wrapped.get(ingredientName)?.get(dayKey);
    if (entered !== undefined) explicit.set(ingredientName, entered);
  }

  applyRecipesToSalesMap(wrapped, recipesByIngredient);
  for (const [ingredientName, qty] of explicit) {
    wrapped.set(ingredientName, new Map([[dayKey, qty]]));
  }

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
  openingAutoFilled: boolean;
}

async function getManualEntries(outletId: string, day: Date): Promise<Map<string, ManualEntry>> {
  const rows = await prisma.inventory.findMany({
    where: { outletId, stockDate: day, source: DataSource.MANUAL },
  });
  const map = new Map<string, ManualEntry>();
  for (const r of rows) {
    map.set(r.itemName, {
      opening: toNum(r.openingStock),
      actualClosing: toNum(r.closingStock),
      unit: r.unit,
      openingAutoFilled: r.openingAutoFilled,
    });
  }
  return map;
}

/**
 * Opening carries over: a day's opening stock is the previous day's actual closing plus
 * whatever PO is due that day. Rows seeded this way stay machine-owned (openingAutoFilled)
 * and are refreshed on every load, so a PO raised later in the day still lands — a one-shot
 * write at rollover would miss it. The moment someone edits Opening by hand the flag clears
 * (see upsertReconciliationEntry) and this leaves the row alone forever after.
 *
 * Deliberately does nothing when the previous day has no saved entry: inventing an opening
 * from an absent closing would make an unrecorded day indistinguishable from one that
 * genuinely closed at zero.
 */
async function carryForwardOpenings(
  outletId: string,
  day: Date,
  itemNames: Iterable<string>,
  today: Map<string, ManualEntry>,
  previousDay: Map<string, ManualEntry>,
  poByItem: Map<string, number>
): Promise<void> {
  const writes: Prisma.PrismaPromise<unknown>[] = [];

  for (const itemName of itemNames) {
    const previous = previousDay.get(itemName);
    if (!previous) continue;

    const derived = previous.actualClosing + (poByItem.get(itemName) ?? 0);
    const current = today.get(itemName);
    if (current && !current.openingAutoFilled) continue;
    // Nothing changed since the last load — don't write on every page view.
    if (current && current.opening === derived) continue;

    today.set(itemName, {
      opening: derived,
      actualClosing: current?.actualClosing ?? 0,
      unit: current?.unit ?? null,
      openingAutoFilled: true,
    });

    writes.push(
      prisma.inventory.upsert({
        where: { outletId_itemName_stockDate: { outletId, itemName, stockDate: day } },
        create: {
          outletId,
          itemName,
          stockDate: day,
          source: DataSource.MANUAL,
          openingStock: derived,
          openingAutoFilled: true,
        },
        update: { openingStock: derived, openingAutoFilled: true, source: DataSource.MANUAL },
      })
    );
  }

  if (writes.length > 0) await prisma.$transaction(writes);
}

export interface ReconciliationRowInputs {
  itemName: string;
  classAItemId: string;
  unit: string | null;
  hasManualEntry: boolean;
  openingAutoFilled: boolean;
  opening: number;
  actualClosing: number;
  salesToday: number;
  predictedSales: number;
  poToday: number;
  poNextDay: number;
  /** PO names linked to this row, so the UI can show and edit them where the 0 appears. */
  purchaseAliases: string[];
}

export interface ReconciliationRow extends ReconciliationRowInputs {
  factualClosingAI: number;
  nextDayOpening: number;
  salesVariance: number;
  wastage: number;
  stockDate: string;
}

/**
 * Pure arithmetic, kept separate from the Prisma queries so the formulas can be
 * reasoned about (and tested) without a database.
 *
 * Closing (AI) is opening minus what actually sold — purchases are deliberately
 * excluded, since stock arriving today isn't counted as sellable until the next
 * day's opening. Next Day Opening therefore pairs today's actual closing with the
 * PO due *tomorrow* (poNextDay), not the one that landed today.
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeReconciliationRow(inputs: ReconciliationRowInputs, stockDate: string): ReconciliationRow {
  const factualClosingAI = inputs.opening - inputs.salesToday;
  const nextDayOpening = inputs.poNextDay + inputs.actualClosing;
  const salesVariance = inputs.salesToday - inputs.predictedSales;
  // Stock unaccounted for against the expected closing — negative when short, positive on surplus.
  const wastage = inputs.actualClosing - factualClosingAI;

  return {
    ...inputs,
    predictedSales: round2(inputs.predictedSales),
    factualClosingAI: round2(factualClosingAI),
    nextDayOpening: round2(nextDayOpening),
    salesVariance: round2(salesVariance),
    wastage: round2(wastage),
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

  // Every read the page needs, issued at once. Nothing is awaited ahead of this batch:
  // against a remote database the serial round-trips, not the queries, are what cost time.
  const [
    recipesByIngredient,
    classAEntries,
    purchaseAliases,
    categorySoldItems,
    salesByItem,
    poByItem,
    poNextDayByItem,
    manualEntries,
    prevDayEntries,
    predictedRows,
    unitByItem,
  ] = await Promise.all([
    getRecipeRules(brand),
    listClassAItems(brand),
    // Keyed by item name, so a row that expanded out of a CATEGORY entry can be linked too.
    listPurchaseAliases(brand),
    getCategorySoldItems(outletId, day),
    getSalesByItemAndDay(outletId, windowStart, day),
    getPOByItem(outletId, day),
    // Next Day Opening is built from stock due to arrive tomorrow, not today's delivery.
    getPOByItem(outletId, addDays(day, 1)),
    getManualEntries(outletId, day),
    // Opening carries over from here — see carryForwardOpenings.
    getManualEntries(outletId, addDays(day, -1)),
    getPredictedSalesRows(outletId, day),
    getUnitFromPO(outletId),
  ]);

  const universe = buildIngredientUniverse(classAEntries, categorySoldItems);
  const poToday = resolvePoByIngredient(universe.keys(), purchaseAliases, poByItem);
  const poNextDay = resolvePoByIngredient(universe.keys(), purchaseAliases, poNextDayByItem);
  const predictedByItem = resolvePredictedSales(predictedRows, dayKey, recipesByIngredient);
  applyRecipesToSalesMap(salesByItem, recipesByIngredient);

  // Mutates manualEntries in place, so the rows below already see the carried-over openings.
  await carryForwardOpenings(outletId, day, universe.keys(), manualEntries, prevDayEntries, poToday);

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
          openingAutoFilled: manual?.openingAutoFilled ?? false,
          opening: manual?.opening ?? 0,
          actualClosing: manual?.actualClosing ?? 0,
          salesToday,
          predictedSales,
          poToday: poToday.get(itemName) ?? 0,
          poNextDay: poNextDay.get(itemName) ?? 0,
          purchaseAliases: purchaseAliases.get(itemName) ?? [],
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
  const existing = await prisma.inventory.findUnique({
    where: { outletId_itemName_stockDate: { outletId: input.outletId, itemName: input.itemName, stockDate: day } },
    select: { openingStock: true },
  });

  const updateData: Prisma.InventoryUpdateInput = { source: DataSource.MANUAL };
  if (input.opening !== undefined) {
    updateData.openingStock = input.opening;
    // Save posts both fields even when only Actual Closing was touched, so hand off ownership
    // of Opening only when the number actually moved — otherwise a closing edit would freeze
    // a carried-over opening and stop later POs counting toward it.
    if (!existing || toNum(existing.openingStock) !== input.opening) {
      updateData.openingAutoFilled = false;
    }
  }
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
      openingAutoFilled: false,
      closingStock: input.actualClosing ?? 0,
      currentStock: input.actualClosing ?? 0,
    },
    update: updateData,
  });
}
