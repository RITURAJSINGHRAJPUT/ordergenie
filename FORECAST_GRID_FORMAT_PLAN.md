# Sales forecast: accept the new per-outlet grid format

## Context

The forecast file now comes out of the AI tool in a new shape
(`assets/Order_geni_Sales_Ai_Oct2026_with_Predictions.xlsx`): **one sheet per outlet**, items down
the rows and dates across the columns. The importer only understands the flat
`Outlet | Item | Date | Qty` template and the old 16-sheet workbook, so this file imports nothing.

Shape of the new file, confirmed by reading it:
- Sheets: `Prediction - Piplod`, `- Vesu`, `- Ahmedabad`, `- Ahmedabad 2.0`, `- Aiko Surat`,
  `- Aiko Ahmedabad`.
- Row 1 a title, row 2 blank, **row 3 the header**: `Category | Item | 2026-10-01 … 2026-10-31 | Total`
  (dates are real Excel dates).
- Rows 4+ are one item each. The last row is a `TOTAL / (31 days)` row, and Aiko sheets carry an
  `Other (monthly total only)` block whose daily cells read `n/a`.
- Quantities in the Total column and the TOTAL row are formulas, so cells arrive as
  `{ result, formula }` rather than plain numbers.

Decided: `Ahmedabad` = **Capiche Ambli** (rid 353369) and `Ahmedabad 2.0` = **Capiche Uni**
(rid 419174), matching the existing map. The downloadable template **switches to this same grid
layout**, so what people download and what gets uploaded agree.

## 1. Parser — `backend/src/services/predictedSales/predictedSalesImport.service.ts`
Add a third format alongside the two already handled in `parseAndImportPredictionWorkbook`; the
flat and 16-sheet paths stay untouched so old files still re-import.

- `isGridTemplate(workbook)`: true when a sheet has a header row (search rows 1–5) whose first two
  cells are `Category`/`Item` (or just `Item`) followed by at least one date cell.
- `parseGridTemplate`: per sheet —
  - **Outlet**: an alias map for the AI tool's short names (`piplod`, `vesu`, `ahmedabad`,
    `ahmedabad 2.0`, `aiko surat`, `aiko ahmedabad` → rid), with the `Prediction - ` prefix
    stripped; falls back to matching the live `Outlet.name`, so template-generated sheets named
    after real outlets work too. Unmatched sheets go to `sheetsSkipped` with a reason, which the
    page already renders.
  - **Dates**: every header cell after Item that reads as a date, reusing `cellDateString`.
    `Total` and any non-date column are ignored.
  - **Rows**: skip a blank Item and any row whose Category is `TOTAL`.
  - **Cells**: unwrap formula cells (`{ result }`), skip blank and `n/a`, keep a real `0` —
    a forecast 0 means "we predict none", which is deliberately different from "no forecast".
- Reuse the existing `PendingUpsert` shape, `chunkedUpsert` and `persistPending`, so logging,
  status and the create/update split are unchanged.

## 2. Template — `backend/src/services/predictedSales/predictionTemplate.service.ts`
Rebuild `buildPredictionTemplate(month)` as the same grid:
- One sheet per active outlet that has Class A items, named `Prediction - <outlet name>`, trimmed
  to Excel's 31-character sheet-name limit.
- Header row 3 (title row 1, blank row 2) to match the AI file exactly: `Category | Item | <each day
  of the month>`.
- Rows from `forecastItemsForBrand(brand)`, which already returns the right items. Category left
  blank — the importer ignores it; it exists so the layouts line up.
- Keep the `Notes` sheet, reworded for the grid: fill the day cells, blank means no forecast, 0
  means predict zero, dough is forecast directly.
- `rows` returned stays the count of item-days so the existing controller response is unchanged.

## 3. Frontend — `frontend/src/app/(protected)/settings/predictions-import/page.tsx`
Update the blurb to say both the per-outlet grid (the AI tool's file) and the older flat template
are accepted. No other UI change: upload, template download, logs and delete all stay as they are.

## Verification
1. `tsc --noEmit` both workspaces, `npm run build` on the frontend.
2. Against a local server as SUPER_ADMIN, import the real file in `assets/`:
   - all 6 sheets processed, none skipped
   - spot-check stored rows against the sheet, e.g. Vesu "11 Inch Pizza" on 1 Oct = 38
   - no row stored for the `TOTAL` row, the `Total` column, or the `n/a` Aiko items
   - re-import the same file: rows update rather than duplicate (`rowsCreated` 0 the second time)
3. Download the new template for a month, fill two cells, upload it, and confirm those two land.
4. Re-import an older flat-template file to confirm that path still works.
5. Delete the imported test rows and their import logs afterwards.
