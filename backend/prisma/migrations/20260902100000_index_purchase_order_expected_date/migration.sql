-- Reconciliation buckets POs by expectedDate (today's PO and the next day's), but the only
-- existing index covers orderDate.
CREATE INDEX "PurchaseOrder_outletId_expectedDate_idx" ON "PurchaseOrder"("outletId", "expectedDate");
