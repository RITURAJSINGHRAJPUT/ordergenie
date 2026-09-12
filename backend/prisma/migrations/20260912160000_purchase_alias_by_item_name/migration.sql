-- Aliases move off ClassAItem onto (brand, itemName). A reconciliation row can arrive either
-- as an ITEM entry or by expanding out of a CATEGORY entry (Aiko's "Drinks" becomes Coke,
-- Diet Coke, ...), and those expanded rows have no ClassAItem to hang an alias on.
CREATE TABLE "PurchaseAlias" (
    "id"         TEXT NOT NULL,
    "brand"      TEXT NOT NULL,
    "itemName"   TEXT NOT NULL,
    "poItemName" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseAlias_brand_itemName_poItemName_key"
    ON "PurchaseAlias"("brand", "itemName", "poItemName");
CREATE INDEX "PurchaseAlias_brand_itemName_idx" ON "PurchaseAlias"("brand", "itemName");

-- Carry over anything already linked under the old column, then retire it.
INSERT INTO "PurchaseAlias" ("id", "brand", "itemName", "poItemName")
SELECT gen_random_uuid()::text, c."brand", c."value", alias
FROM "ClassAItem" c, unnest(c."purchaseAliases") AS alias
ON CONFLICT DO NOTHING;

ALTER TABLE "ClassAItem" DROP COLUMN "purchaseAliases";
