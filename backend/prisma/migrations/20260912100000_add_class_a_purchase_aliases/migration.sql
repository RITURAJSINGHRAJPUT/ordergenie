-- PO item names a Class A Item also counts. Sold and purchased names never overlap in
-- Petpooja data, so the item's `value` matches sales while these match purchase orders.
ALTER TABLE "ClassAItem" ADD COLUMN "purchaseAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
