import { PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/apiResponse';
import { isTransferWebhookRecord, mapPurchaseOrderWebhook } from './mappers/purchaseOrderWebhookMapper';
import type { PetpoojaPurchaseOrderWebhookPayload } from './types';

async function resolveVendorId(name: string | null): Promise<string | undefined> {
  if (!name) return undefined;
  const existing = await prisma.vendor.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.vendor.create({ data: { name } });
  return created.id;
}

export interface PurchaseOrderWebhookResult {
  outletId: string;
  purchaseOrderId: string;
  result: 'created' | 'updated';
  status: PurchaseOrderStatus;
}

/**
 * Petpooja calls this "menuSharingCode" (their term, used the same way across all
 * 14 Inventory API endpoints); for outlets with a dedicated Inventory API
 * integration it's Outlet.inventorySyncCode — confirmed against apidocs/apidocs.txt
 * (real onboarding emails), where the "Menu Sharing Sync Code" values match our
 * seeded inventorySyncCode values verbatim.
 *
 * Billing outlets (Capiche/Aiko/Bookends — salesSyncCode only, no separate
 * Inventory API integration) don't have an inventorySyncCode at all, so their PO
 * webhooks would never resolve on that field alone — every real Capiche/Aiko
 * outlet has inventorySyncCode = null. This mirrors the same billing/inventory
 * duality purchaseSync.service.ts already handles on the pull side (billing
 * outlets' purchases come back keyed by salesSyncCode instead), so resolution
 * here checks both fields.
 */
export async function handlePurchaseOrderWebhook(
  payload: PetpoojaPurchaseOrderWebhookPayload
): Promise<PurchaseOrderWebhookResult> {
  const menuSharingCode = payload.data.menuSharingCode ?? payload.menuSharingCode;
  const outlet = menuSharingCode
    ? await prisma.outlet.findFirst({
        where: { OR: [{ inventorySyncCode: menuSharingCode }, { salesSyncCode: menuSharingCode }] },
      })
    : null;
  if (!outlet) {
    throw new AppError(`No outlet configured with sync code "${menuSharingCode ?? ''}"`, 422);
  }

  // Internal outlet-to-outlet transfers ("Kitchen" receiverType) are still labeled below
  // (Purchase data), but no longer written to InventoryTransaction — stock-level/transfer
  // tracking was dropped, Sales + Purchase only.
  const isTransfer = isTransferWebhookRecord(payload.data);

  const mapped = mapPurchaseOrderWebhook(payload.data);
  const vendorName = isTransfer ? `${mapped.vendorName ?? 'Internal'} (Internal Transfer)` : mapped.vendorName;
  const vendorId = await resolveVendorId(vendorName);
  const status = mapped.isCancelled ? PurchaseOrderStatus.CANCELLED : PurchaseOrderStatus.PENDING;

  // Keyed on petpoojaPurchaseId (Petpooja's own immutable "id"), not poNumber — same
  // reasoning as purchaseSync.service.ts's upsertPurchaseOrder: poNumber isn't a safe
  // dedup key since Petpooja can change it. This is also what makes webhook retries
  // safe/idempotent — Petpooja may redeliver the same PO save event more than once.
  const existing = await prisma.purchaseOrder.findUnique({
    where: { outletId_petpoojaPurchaseId: { outletId: outlet.id, petpoojaPurchaseId: mapped.petpoojaPurchaseId } },
    select: { id: true },
  });

  const scalarData = {
    petpoojaPurchaseId: mapped.petpoojaPurchaseId,
    vendorId,
    invoiceNumber: mapped.invoiceNumber,
    status,
    totalAmount: mapped.totalAmount,
    taxAmount: mapped.taxAmount,
    orderDate: mapped.orderDate,
    expectedDate: mapped.expectedDate,
    rawPayload: mapped.rawPayload as object,
  };

  const items = mapped.items.map((i) => ({
    itemName: i.itemName,
    quantity: i.quantity,
    unit: i.unit,
    rate: i.rate,
    amount: i.amount,
    cgst: i.cgst,
    sgst: i.sgst,
    igst: i.igst,
    cess: i.cess,
    receivedQty: i.receivedQty,
    pendingQty: i.pendingQty,
  }));

  if (existing) {
    await prisma.purchaseOrder.update({
      where: { id: existing.id },
      data: { ...scalarData, items: { deleteMany: {}, create: items } },
    });
    return { outletId: outlet.id, purchaseOrderId: existing.id, result: 'updated', status };
  }

  const created = await prisma.purchaseOrder.create({
    data: { outletId: outlet.id, poNumber: mapped.poNumber, ...scalarData, items: { create: items } },
  });
  return { outletId: outlet.id, purchaseOrderId: created.id, result: 'created', status };
}
