import { ApiType, PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/apiResponse';
import { resolveWebhookSecrets } from './credentials';
import { isTransferWebhookRecord, mapPurchaseOrderWebhook } from './mappers/purchaseOrderWebhookMapper';
import type { PetpoojaPurchaseOrderWebhookPayload } from './types';

/**
 * Petpooja's Inventory API docs state credentials "remain constant for all API
 * calls" — confirmed against a real onboarding email (apidocs/apidocs.txt), which
 * shows the same app_key/app_secret/access_token used for the Purchase (get_purchase)
 * API. So the webhook is verified against the same ApiType.PURCHASE credentials
 * already configured, rather than a separate credential set.
 *
 * Only app_secret is checked. Real PO webhook deliveries have been observed with
 * app_key mismatched/placeholder and access_token blank, even though the PO data
 * itself (payload.data) is complete and correct — so app_key/access_token aren't
 * reliable enough to gate on. app_secret is still a genuine shared secret and is
 * always present. It's checked against both the stored app_secret and access_token
 * because Petpooja's official API 8 (PO webhook) reference documents access_token/
 * app_secret as swapped in this specific payload — their example shows
 * `"access_token": "YOUR_APP_SECRET"` and `"app_secret": "YOUR_ACCESS_TOKEN"` — so
 * the real secret can legitimately land in either stored slot.
 *
 * Uses resolveWebhookSecrets, not resolveCredentials — resolveCredentials refuses to
 * return anything unless app_key/app_secret/access_token are ALL saved (it's used for
 * real outbound API calls that need all three together), but the realistic state for
 * this integration is that only app_secret is ever configured. Gating on
 * resolveCredentials here meant every webhook 401'd regardless of this check.
 */
export async function verifyWebhookCredentials(payload: PetpoojaPurchaseOrderWebhookPayload): Promise<boolean> {
  if (!payload.app_secret) return false;
  const secrets = await resolveWebhookSecrets(ApiType.PURCHASE);
  return secrets.includes(payload.app_secret);
}

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
