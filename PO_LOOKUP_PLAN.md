# PO Lookup — one prep list per city

## Context

Each city's prep kitchen serves several restaurants, and today the only way to know how much to
chop is to open each outlet's purchase orders and add it up by hand. The ask: one page split into
**Surat** and **Ahmedabad**, totalling every item across that city's outlets — "chopped onions:
Vesu needs this much, Piplod that much, total that" — for every item.

Decided with the user:
- **Surat** = Aiko (Surat), Capiche (Piplod), Capiche (Vesu). **Ahmedabad** = Aiko (Ahmedabad),
  Capiche Ambli, Capiche Uni. Restaurant outlets only; KG stores, bakeries and prep kitchens do the
  prepping rather than ordering it.
- **One day at a time, by delivery date**, falling back to the order date when a PO has no expected
  date.
- **Everyone can see it**, every signed-in role.

What the exploration established, and which shapes the implementation:
- `purchaseOrders.service.ts` already has exactly the date rule wanted, in a private `dateClause`:
  `expectedDate` within the day, **OR** `expectedDate IS NULL AND orderDate` within the day. It
  exists because ~41% of POs arrive with no expected date — every `get_purchase`-synced PO has
  `expectedDate = null`. Export it and reuse rather than writing a second copy.
- **Units are not consistent per item** and must never be summed across. `lbl_unit` is copied
  verbatim from Petpooja, is nullable, and real values include non-units like `"Qty"`. Three places
  in the codebase already say so; `listPurchaseOrderItemsByDay` groups by `(itemName, unit)` and
  this will too.
- `city` exists on `Outlet` but is only ever **displayed** today — nothing groups by it yet. It is
  null for six outlets, so the grouping must tolerate that.
- `PurchaseOrderItem` has **no indexes at all**, and `itemName` is free text. Filtering goes through
  the `purchaseOrder` relation, which is indexed on `(outletId, expectedDate)`.

## Backend

**`src/services/purchase/poLookup.service.ts`** (new)
- `getPoLookup(date)` → `[{ city, outlets: [{ id, name }], rows: [{ itemName, unit, byOutlet: Record<outletId, number>, total }] }]`, Surat first, then Ahmedabad.
- Outlets per city, rather than hard-coded ids so a new restaurant appears on its own:
  `isActive`, `outletType = OUTLET`, `city` not null, and brand **not** `KG`/`Internal` — which is
  exactly the six outlets named above today. Cities come from the outlets found, each becoming a
  section.
- One `purchaseOrderItem.findMany` for all of them, filtered by those outlet ids, the exported
  `dateClause('expectedDate', from, to)` and `status: { not: CANCELLED }`, selecting
  `itemName, unit, quantity, purchaseOrder: { outletId }`.
- Folded in memory keyed `${itemName.trim().toLowerCase()}|${unit ?? ''}` — case-insensitive so two
  spellings don't split a row, keeping the first spelling seen for display. Rows sorted by total
  descending, so the biggest prep jobs lead.
- `resolveDateRange({ from: date, to: date })` gives the IST day boundaries, as everywhere else.

**`src/services/purchase/purchaseOrders.service.ts`**: export `dateClause` (currently private) with a
comment that PO Lookup shares it, so the two can't drift apart.

**Controller + route**: `src/controllers/poLookup.controller.ts`, `src/routes/poLookup.routes.ts`,
registered as `/po-lookup`. Gated `verifyJwt` + `requireRole(…every role…)` and **deliberately
without `scopeToOutlet`/`scopeToBrand`**: the page is a city total by definition, so a Capiche head
chef will see Aiko's quantities in the same table. That is the point of it, but it is a visibility
change worth being explicit about.

## Frontend

- **`src/hooks/usePoLookup.ts`**: `usePoLookup(date)` → `GET /po-lookup?date=…`.
- **`src/app/(protected)/po-lookup/page.tsx`**: a single date input defaulting to **tomorrow**
  (prep happens the day before), then one card per city:

```
SURAT · 15 Oct 2026              Piplod   Vesu   Aiko   TOTAL
  Chopped Onions        kg          3       5      2      10
  Mozzarella Cheese 1kg Qty         4       6      —      10
```

  Outlet columns come from that city's outlet list, a dash where an outlet ordered none. Mobile
  gets one card per item instead of a wide table, reusing the pattern in `PurchaseOrdersByDayView`.
  Empty day → "No purchase orders due on this date".
- **Nav** (`src/components/layout/nav-items.ts`): a top-level "PO Lookup" entry next to Purchase
  Orders. Head Chef's nav is an allowlist that keeps only Dashboard and brand sections
  (`filterForHeadChef`), so that function needs to keep allowlisted **top-level** items too —
  otherwise "everyone" quietly excludes the role most likely to use this.
- **`src/types/api.ts`**: `PoLookupCity`, `PoLookupRow`.

## Verification

The local Postgres is an EDB install that needs sudo to start, so as with the last two changes the
endpoint is tested against a stubbed Prisma client and self-signed tokens (the harness in the
session scratchpad).

1. `tsc --noEmit` both workspaces, `npm run build` on the frontend.
2. Endpoint tests:
   - An item ordered by two Surat outlets appears once with both quantities and the correct total.
   - The same item in two different units stays on two rows and is never summed together.
   - A PO with no `expectedDate` is counted on its **order** date; one with an expected date is
     counted on that date, not its order date.
   - CANCELLED POs are excluded; a KG store's PO never appears.
   - Case differences in `itemName` fold into one row.
   - Every role gets 200, including HEAD_CHEF and VIEWER, and a head chef sees the whole city.
3. In the browser: the Surat and Ahmedabad cards render with the right outlet columns, and the date
   picker moves both.
