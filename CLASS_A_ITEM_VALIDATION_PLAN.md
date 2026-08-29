# Validate Class A Item names against real data, with suggestions

## Context

Several reconciliation bugs (dead "Garlic Knots"/`15"` triggers, lowercase `coke`/`diet coke`
duplicates, Coke/Diet Coke pack-size mismatches) traced back to one root cause: adding a
Class A Item was completely unvalidated.

- Two UI entry points — the Reconciliation tab's inline "Add Ingredient" box (`type` hardcoded
  to `ITEM`) and the dedicated Class A Items page (`ITEM` or `CATEGORY`) — both call the same
  `useAddClassAItem()` hook → `POST /class-a-items`.
- `CATEGORY` was already safe: a closed `<Select>` populated from real distinct `SaleItem.category`
  values. Can't be typo'd.
- `ITEM` was raw free text with no validation beyond non-empty. The backend upserted whatever
  string was typed. A typo'd or nonexistent name silently became a permanent all-zero
  reconciliation row, indistinguishable from a real item that just hadn't sold that day.

Decision: **hard block**. An `ITEM`-type Class A Item cannot be added unless it matches
(case-insensitively) a real name from Sales or Purchase data. No override.

## What was built

### 1. Backend — real-name lookup + suggestions
`backend/src/services/classAItems/classAItems.service.ts`:
- `listRealItemNames(brand)` — distinct `SaleItem.itemName` (via `sale.outlet.brand`) plus distinct
  `PurchaseOrderItem.itemName` (via `purchaseOrder.outlet.brand`), deduped case-insensitively.
- `addClassAItem()` now checks `ITEM` values against that pool. An exact (case-insensitive) match
  is stored using the **real** spelling, so casing variants can no longer create duplicate entries.
- No match → `AppError('No item with this name exists in Sales or Purchase data', 400, { suggestions })`.
- `suggestNames()` ranks candidates by substring hit first, then Levenshtein distance
  (`fastest-levenshtein`, new dependency). Substring outranks raw distance because real names carry
  pack-size suffixes — "Coke" vs "Coke 300 Ml" is 7 edits apart but obviously relevant.

### 2. Backend — surfacing suggestions
- `AppError` gained an optional `details?: unknown` third constructor arg (`utils/apiResponse.ts`).
- `errorHandler` includes `details` in the JSON body when present (`middleware/error.middleware.ts`).
- The controller needed no change — validation lives entirely in the service.

### 3. Frontend
- `useAddClassAItem()` extracts `details.suggestions` from the axios error, surfaces the server's
  own message in the toast, and returns `{ suggestions, clearSuggestions }` alongside the mutation.
- `SuggestionChips` (exported from `BrandClassAItemsTab.tsx`) renders "Did you mean:" chips that
  refill the input on click — not auto-submitted.
- Wired into both `BrandClassAItemsTab.tsx` (ITEM branch only) and `BrandReconciliationTab.tsx`.

### Out of scope
- `CATEGORY` add flow — already safe.
- Live as-you-type autocomplete — validation happens on submit.
- The Coke/Diet Coke PO pack-size rollup fix (recipe-rule-based PO matching). That's a separate,
  complementary fix for *existing* mismatched data; this change is purely preventative for *new*
  entries. Existing Class A Items are unaffected.

## Files touched
- `backend/package.json` (`fastest-levenshtein`)
- `backend/src/utils/apiResponse.ts`
- `backend/src/middleware/error.middleware.ts`
- `backend/src/services/classAItems/classAItems.service.ts`
- `frontend/src/hooks/useClassAItems.ts`
- `frontend/src/components/brand-workspace/BrandClassAItemsTab.tsx`
- `frontend/src/components/brand-workspace/BrandReconciliationTab.tsx`

## Verification (done)
- `tsc --noEmit` clean on both backend and frontend.
- Service-level, against the local dev DB (test rows cleaned up afterward):
  - `"  cOkE "` → stored as `"Coke"` (trimmed + real casing).
  - `"Coke Zeroo"` → 400, suggestions `["Coke Zero","Coke","Coke Float","Coke 300 Ml","Coke 330 Ml"]`.
  - `"Garlic Knots"` → 400, suggestions `["Garlic","Garlic Chop","Garlic Oil","Garlic Bread","Garlic Slice"]`.
  - `CATEGORY` add → unaffected.
- HTTP: `POST /api/class-a-items` with a bogus name returns
  `400 {"success":false,"message":"...","details":{"suggestions":[...]}}`.
