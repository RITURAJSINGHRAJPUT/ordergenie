import { SyncStatus, TriggerType } from '@prisma/client';
import { prisma } from '../../config/db';
import { dateOnlyUtc } from '../../utils/dateRange';

// Only the trailing 7 days (including today) are kept at all — Sale/PurchaseOrder
// (and their line items, via cascade), InventoryTransaction, and the SyncLog history
// of the runs themselves older than this are auto-deleted nightly. E.g. on Aug 20,
// keeps Aug 14-20; on Aug 21 the window shifts and Aug 14 is the one that gets
// dropped. Deliberate: this app only needs recent history for Reconciliation (7-day
// trailing average) and day-of Sold Out lookups; unbounded retention is what caused a
// hosting provider's disk to fill up entirely. SyncLog is on the same window because
// the 5-minute Sales/Purchase crons write one row per outlet per run — ~9k rows a day,
// which had grown to 45 MB, larger than every other table combined.
// Sales/Item Sales/Reports pages will only ever show this trailing window.
const DATA_RETENTION_DAYS = 7;

/**
 * Nightly cleanup only — deletes data older than DATA_RETENTION_DAYS. No trailing-
 * window resync here anymore (Sales/Purchase cron handlers now cover today+yesterday
 * on every 5-min run, so late corrections are already caught without a separate pass).
 *
 * Writes its own SyncLog row (outletId: null) rather than using runSync(), since this
 * is a single global operation, not a per-outlet one — that's what makes it show up in
 * the Settings > Sync Schedule "Recent Sync Runs" table when triggered manually.
 */
export async function runDataRetentionCleanup(triggerType: TriggerType, triggeredByUserId?: string) {
  const log = await prisma.syncLog.create({
    data: { syncType: 'HISTORICAL', triggerType, status: SyncStatus.RUNNING, triggeredByUserId },
  });

  try {
    const now = new Date();
    // "7 days including today" means the oldest kept day is (today - 6), so anything
    // before that gets deleted — not (today - 7), which would keep an 8th day.
    const cutoff = dateOnlyUtc(now.getFullYear(), now.getMonth(), now.getDate() - (DATA_RETENTION_DAYS - 1));

    // Sale -> SaleItem and PurchaseOrder -> PurchaseOrderItem both cascade on delete
    // (schema.prisma), so pruning the parent rows is enough to clean up line items too.
    const [prunedSales, prunedPurchaseOrders, prunedInventoryTransactions, prunedSyncLogs] = await Promise.all([
      prisma.sale.deleteMany({ where: { orderDate: { lt: cutoff } } }),
      prisma.purchaseOrder.deleteMany({ where: { orderDate: { lt: cutoff } } }),
      prisma.inventoryTransaction.deleteMany({ where: { transactionDate: { lt: cutoff } } }),
      // This run's own log row was created moments ago, so it sits inside the window
      // and can't be deleted by its own sweep.
      prisma.syncLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ]);

    const result = {
      prunedSales: prunedSales.count,
      prunedPurchaseOrders: prunedPurchaseOrders.count,
      prunedInventoryTransactions: prunedInventoryTransactions.count,
      prunedSyncLogs: prunedSyncLogs.count,
    };

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: SyncStatus.SUCCESS,
        completedAt: new Date(),
        recordsFetched:
          result.prunedSales + result.prunedPurchaseOrders + result.prunedInventoryTransactions + result.prunedSyncLogs,
        recordsCreated: 0,
        recordsUpdated: 0,
      },
    });

    return result;
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: SyncStatus.FAILED, completedAt: new Date(), errorMessage: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
