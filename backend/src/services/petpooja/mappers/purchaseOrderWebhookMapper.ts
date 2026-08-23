import type { PetpoojaPurchaseOrderWebhookData, PetpoojaPurchaseOrderWebhookItem } from '../types';
import type { MappedPurchase, MappedPurchaseItem } from './purchaseMapper';

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parsePetpoojaDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  return new Date(value.includes('T') ? value : `${value}T00:00:00Z`);
}

function mapItem(item: PetpoojaPurchaseOrderWebhookItem): MappedPurchaseItem {
  const quantity = num(item.qty);
  const rate = num(item.price);
  const amount = num(item.amount, quantity * rate);

  return {
    itemName: item.itemname ?? 'Unknown Item',
    quantity,
    unit: item.lbl_unit ?? null,
    rate,
    amount,
    cgst: num(item.tax1_amount),
    sgst: num(item.tax2_amount),
    igst: num(item.tax3_amount),
    cess: num(item.tax4_amount),
    receivedQty: 0, // a PO isn't a receipt yet — nothing has arrived at the outlet
    pendingQty: quantity,
  };
}

export interface MappedPurchaseOrder extends MappedPurchase {
  expectedDate: Date | undefined;
  isCancelled: boolean;
}

/**
 * Same discriminator as the pull API (purchaseMapper.ts's isTransferRecord) —
 * receiverType "Kitchen" instead of "Supplier" marks an internal outlet-to-outlet
 * transfer rather than a real vendor purchase. Confirmed live via a real webhook
 * delivery (Capiche Piplod -> Surat Store, receiverType "Kitchen").
 */
export function isTransferWebhookRecord(data: PetpoojaPurchaseOrderWebhookData): boolean {
  return data.receiverType === 'Kitchen' || data.restDetails?.receiver?.receiver_type === 'Kitchen';
}

/**
 * Petpooja's PO webhook payload doesn't include a creation timestamp for the PO
 * itself (only `deliveryDate`, the expected receipt date) — `orderDate` here is
 * this server's receipt time, documented so it isn't mistaken for Petpooja's own
 * PO creation time.
 */
export function mapPurchaseOrderWebhook(data: PetpoojaPurchaseOrderWebhookData): MappedPurchaseOrder {
  const items = (data.itemDetails ?? []).map(mapItem);
  const taxAmount = num(data.totalTax, items.reduce((s, i) => s + i.cgst + i.sgst + i.igst + i.cess, 0));
  const receiver = data.restDetails?.receiver;

  return {
    poNumber: data.poNumber,
    petpoojaPurchaseId: data.id,
    poId: null, // this mapper builds the PO itself, not an invoice raised against one
    invoiceNumber: null,
    orderDate: new Date(),
    expectedDate: parsePetpoojaDate(data.deliveryDate),
    vendorName: receiver?.receiver_name?.trim() || null,
    vendorPetpoojaId: null,
    vendorPhone: receiver?.receiver_contact || null,
    totalAmount: num(data.total, items.reduce((s, i) => s + i.amount, 0) + taxAmount),
    taxAmount,
    rawPayload: data as unknown as MappedPurchase['rawPayload'],
    items,
    isCancelled: data.status !== undefined && data.status !== 'Active',
  };
}
