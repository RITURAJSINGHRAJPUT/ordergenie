-- Marks an Inventory row's openingStock as machine-derived (previous day's closing +
-- that day's PO). Existing rows were all entered by hand, so they default to false.
ALTER TABLE "Inventory" ADD COLUMN "openingAutoFilled" BOOLEAN NOT NULL DEFAULT false;
