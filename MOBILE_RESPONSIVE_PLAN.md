# Mobile-Responsive OrderGenie Frontend

## Context
OrderGenie (Next.js 16 App Router, Tailwind v4, shadcn/ui on `@base-ui/react`) is used by outlet staff, who are often on phones. Only the app shell is mobile-aware today: the sidebar turns into a drawer below `md`. Pages, filter bars, ~20 data tables, dialogs, tabs and charts were all built for desktop. On a 320–430px screen they overflow, get cramped, or have targets too small for fingers. Only `BrandReconciliationTab` has a real mobile layout (a table from `md` up, stacked cards below).

**Goal:** every route works cleanly from 320px wide (iPhone SE) up through tablets, in portrait and landscape, in light and dark mode, in the browser and as the installed PWA. The desktop layout (≥1024px) stays visually unchanged.

**Decisions agreed with the user**
- **Tables:** mobile cards for the key operational tables. Admin/settings tables keep horizontal scroll, with their overflow bugs fixed.
- **Touch sizing:** on touch devices only (`pointer-coarse:`), default-size controls grow to ~40px. Desktop with a mouse stays identical.
- **Breakpoints:** Tailwind defaults (sm 640 / md 768 / lg 1024). `md` is the line between card view and table view, matching Reconciliation.

**Step 0:** save this plan in the repo as `MOBILE_RESPONSIVE_PLAN.md`, following the existing root-level `*_PLAN.md` convention. Work on branch `mobi` and commit once per phase.

> Per `frontend/AGENTS.md`, check `node_modules/next/dist/docs/` before touching Next APIs. `viewportFit` is confirmed in `node_modules/next/dist/lib/metadata/types/extra-types.d.ts:52`.

All paths below are relative to `frontend/src/`.

---

## Phase 1: Foundations (shared, high leverage)

1. **Viewport and safe areas**, in `app/layout.tsx`:
   - Add `viewportFit: 'cover'` to `viewport`.
   - Pad the shell with `env(safe-area-inset-*)` using Tailwind arbitrary values: bottom inset on `<main>`, left/right in landscape, and the inset on the drawer.
2. **App shell**, in `components/layout/AppShell.tsx`:
   - `h-screen` → `h-dvh`. This fixes the iOS Safari address-bar jump.
   - Add `min-w-0` to the `flex-1` column so wide children can't push the layout wider than the screen.
   - Change main padding to `p-3 sm:p-4 md:p-6`.
3. **Mobile drawer**, in `components/layout/Header.tsx` and `Sidebar.tsx`:
   - Make the `Sheet` controlled (`open`/`onOpenChange`) and pass `onNavigate={() => setOpen(false)}` to `<Sidebar>`. Fixes the bug where the drawer stays open after a tap.
   - Add a `showCollapseToggle` prop to `Sidebar` (default `true`). Pass `false` in the drawer, which removes the overlap with the sheet's X button.
   - Set the drawer to `w-72 max-w-[85vw]`.
   - Increase nav link padding on touch: `pointer-coarse:py-2.5`.
   - Header: truncate the outlet name (`truncate max-w-[40vw]`), and use `gap-2 sm:gap-3`.
4. **New hook `hooks/useMediaQuery.ts`:**
   - `useMediaQuery(query)` built on `useSyncExternalStore` + `matchMedia`. The server snapshot is `false`.
   - `useIsMobile()` returns the result for `(max-width: 767px)`.
   - It is only for things CSS can't do: Recharts props and DateRangePicker month count.
5. **Dialogs**, in `ui/dialog.tsx`:
   - Add `max-h-[calc(100dvh-2rem)] overflow-y-auto` to the `DialogContent` base, so long forms (Users create/edit, API settings) can scroll with the keyboard open.
   - Remove the now-redundant `max-h-[85vh] overflow-y-auto` from `ItemDetailDialog`, `PurchaseOrderDetailDialog` and `WebhookLogDetailDialog`.
6. **Tabs**, in `ui/tabs.tsx`:
   - Give `TabsList` `max-w-full overflow-x-auto justify-start` with the scrollbar hidden. Long tab sets (API Explorer, including the nested tabs) then scroll sideways instead of overflowing.
   - Add a small `.scrollbar-none` utility in `app/globals.css` via `@utility`.
7. **Touch sizing** (`pointer-coarse:` is built into Tailwind v4):
   - `ui/button.tsx`: `default` → `pointer-coarse:h-10`; `lg` → `pointer-coarse:h-11`; `icon` → `pointer-coarse:size-10`. Leave `xs`, `sm` and `icon-xs`/`icon-sm` alone.
   - `ui/input.tsx`: add `pointer-coarse:h-10` to the base.
   - `ui/select.tsx`: add `data-[size=default]:pointer-coarse:h-10` to `SelectTrigger`.
   - **Caveat:** tailwind-merge does not drop a `pointer-coarse:` class when a caller passes a plain `h-7`.
     - Compact in-table inputs on desktop-table rows must also carry `pointer-coarse:h-8`: `BrandReconciliationTab.tsx:555,571`, `BrandSoldOutTab.tsx:195`, and the sync-page row input.
     - Remove the `h-7` override on the mobile-card inputs (`BrandReconciliationTab.tsx:699,710`) so they get the full touch size.
8. **Shared card primitives**, in new `components/shared/MobileCard.tsx`:
   - `MobileCard` takes `title`, an optional `aside` (badge or amount, top-right), optional `actions`, and `children`, plus `onClick`/expand support.
   - `MobileFields`/`MobileField` render a `<dl>` with `grid grid-cols-2 gap-x-4 gap-y-2`, a muted `text-[11px]` label and the value.
   - Styling copies `ReconciliationCard` (`Card p-0` → `CardContent p-3 space-y-3`, around `BrandReconciliationTab.tsx:641`) so the new cards look like the existing one. Reconciliation itself stays as it is.
9. **Shared components:**
   - `shared/Pagination.tsx`: `flex-wrap gap-2`, and shorten the summary text below `sm`.
   - `shared/DateRangePicker.tsx`: `numberOfMonths={isMobile ? 1 : 2}`, and the trigger is `w-full sm:w-auto`.
   - `shared/DateRangeFilter.tsx`: presets wrap, and controls are full width on mobile.
   - `shared/OutletCards.tsx`: below `md`, a single horizontally scrolling snap row (`flex overflow-x-auto snap-x`) instead of a tall stack of `w-[150px]` cards. Wrap as today from `md` up.
   - `layout/AlertsBell.tsx`: popover width `w-[min(20rem,calc(100vw-1.5rem))]`.

## Phase 2: Fix outright overflow bugs
- `components/dashboard/SalesTrendChart.tsx:10`: `col-span-2` → `lg:col-span-2`. It currently creates a phantom column in the one-column mobile grid.
- `components/petpooja-explorer/ReceivedPurchaseOrdersTab.tsx:77`: the filter row gets `flex-wrap`, and each `w-[180/200px]` becomes `w-full sm:w-[…]`.
- `components/brand-workspace/BrandSoldOutTab.tsx:110`: the add row gets `flex-wrap`, and the controls are `w-full sm:w-48` / `sm:w-24`.
- `components/brand-workspace/BrandPurchaseOrdersTab.tsx:54-61`: the header stacks on mobile, and search becomes `w-full sm:w-[200px]`.
- `components/petpooja-explorer/ExplorerResults.tsx:143`: the raw JSON cell gets `whitespace-pre-wrap break-all max-w-[24rem]`.
- `app/(protected)/settings/sync/page.tsx:79`: move `flex` from the `<TableCell>` onto an inner `<div>`.
- **iOS focus zoom** (inputs need ≥16px text on mobile): switch to `text-base md:text-sm` in these three places:
  - `settings/sync/page.tsx:65`
  - the raw `<textarea>` at `BrandWastageTab.tsx:134`
  - the file input at `settings/predictions-import/page.tsx:107`

## Phase 3: Responsive patterns swept across pages
Apply these to every page and tab below. Describe each change once, then apply it everywhere it occurs.

- **Filter bars:** every fixed-width control `w-[Npx]` / `w-48` becomes `w-full sm:w-[Npx]` inside `flex flex-wrap gap-2`. Inline buttons (Export, Apply) go full width only when they are the last item on their row.
  - `settings/activity/page.tsx`: 7 controls
  - `item-sales/page.tsx`, `purchase-orders/page.tsx`, `inventory/page.tsx`
  - `BrandClassAItemsTab.tsx`, `WebhookDeliveryLogTab.tsx`, `settings/predictions-import/page.tsx`
- **Card headers forced into a row:** `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`.
  - `SalesTransactionsTable.tsx:58`, `ExplorerResults.tsx`, `SalesApiTab.tsx:105`, `settings/api-explorer/page.tsx:187`
- **Full-height pages:** `min-h-screen` → `min-h-dvh` in `(auth)/layout.tsx`, `offline/page.tsx` and `ClosingReminderOverlay.tsx`. Then check the login form at 320px.
- **Touch targets:**
  - Bare `p-1` icon buttons → `p-2 md:p-1` (`BrandWastageTab.tsx:193-199`, `BrandReconciliationTab.tsx:617-624,656-684`).
  - The 12px remove icon (`BrandClassAItemsTab.tsx:117-123`) gets a ≥32px hit area.
  - Text-link buttons get vertical padding (`settings/users/page.tsx:91-100`, `settings/sync/page.tsx:80-86`, `settings/predictions-import/page.tsx:207-212`).
- **Hover-only info:** where a `title=` holds information the user needs (`BrandReconciliationTab.tsx:583-587`, `settings/sync/page.tsx:129`, `predictions-import/page.tsx:195`, ExplorerResults badges), also show that text inline below `md`. On mobile cards this comes naturally as a field.

## Phase 4: Mobile card views for key tables
**Pattern** (from `BrandReconciliationTab.tsx:286-398`):
- Wrap the existing `<Table>` in `hidden md:block`, and leave the table itself untouched.
- Add a sibling `md:hidden space-y-3` list of `MobileCard`s built from the same `rows`.
- Loading skeletons, empty states and `Pagination` are shared by both views.

| File | Card title / aside | Fields | Notes |
|---|---|---|---|
| `components/sales/SalesTransactionsTable.tsx` | Invoice # / Net | Outlet, Date·Time, Customer, Gross, Discount, Tax, Payment | Tapping expands an items list (`useSaleDetail`) shown as "item × qty — amount" rows, not a nested table |
| `app/(protected)/inventory/page.tsx`, `brand-workspace/BrandInventoryTab.tsx` | Item / stock status badge | The most important 6–8 of the 11 columns | Same card is reusable by both, so extract it if their columns match |
| `app/(protected)/item-sales/page.tsx` | Item / Amount | Category, Qty, other cols | Rows open `ItemDetailDialog` on tap, as now |
| `app/(protected)/purchase-orders/page.tsx`, `brand-workspace/BrandPurchaseOrdersTab.tsx` | PO # / Status | Outlet, Supplier, Date, Total | Tap opens `PurchaseOrderDetailDialog` |
| `components/purchase-orders/PurchaseOrderDetailDialog.tsx` | Line item / Amount | Qty, Unit, Rate | Inside the dialog |
| `app/(protected)/outlets/page.tsx` | Outlet / Status | Both tables' columns | Two card lists |
| `brand-workspace/BrandWastageTab.tsx` | Item / Wastage qty | Remaining of the 10 columns | Keep the edit and delete actions in the card's `actions` |
| `brand-workspace/BrandSoldOutTab.tsx` | Item / status | Editable input + Save inside the card | |
| `brand-workspace/BrandPredictionsTab.tsx`, `purchase-orders/PurchaseOrdersByDayView.tsx` | n/a | n/a | Only 5 and 4 columns. Check at 360px and add cards only if they still overflow |

**Admin and settings tables keep horizontal scroll:** users, activity, sync, predictions-import, the explorer results, the received-PO tab and the webhook log. Each gets a scroll container plus the Phase 2/3 fixes.

## Phase 5: Charts and KPI cards
These live in `components/dashboard/*` and use `useIsMobile()`.

- **Chart height:** `h-60 md:h-72`.
- **Horizontal bar charts** (`OutletComparisonChart.tsx:17,20`, `TopSellingItemsChart.tsx:17,20`):
  - On mobile, the left margin drops from 24 to 0 and the category `YAxis` width from 140 to ~90.
  - Category labels are truncated by a tick formatter, with the full name kept in the tooltip.
- **`SalesTrendChart.tsx:19`:** Y-axis width 80 → 56 on mobile, with compact ₹ formatting (e.g. ₹1.2L).
- **`HourlySalesChart.tsx:19-20`:** X-axis `interval` 2 → 5 on mobile.
- **`PaymentBreakdownChart.tsx`:** on mobile, `outerRadius` 90 → 70 and the legend moves to the bottom.
- **`ItemDetailDialog.tsx:30-55`:** apply the same treatment.
- **KPI cards** (`KpiCard.tsx:22`):
  - Value text becomes `text-lg sm:text-2xl tabular-nums` with `min-w-0 break-words`, so ₹ lakh amounts don't get clipped in the 2-column mobile grid.
  - These grids use the same treatment: `dashboard/page.tsx:35`, `BrandOverviewTab.tsx:35`, `BrandClassAItemsTab.tsx:53`, `ExplorerResults.tsx:47`.

---

## Verification
1. **Static checks:** run `npm run lint -w frontend` and `npm run build -w frontend`. The build type-checks and must pass.
2. **Run the app:** `npm run dev -w frontend`, then open http://localhost:3006.
3. **Test in Chrome DevTools device mode** at these widths:
   - 320 (iPhone SE 1st gen)
   - 360 (Android)
   - 375, 390 and 430 (iPhones)
   - 768 (iPad portrait)
   - 667×375 (landscape)
4. **Cover every route:**
   - dashboard, sales, item-sales, inventory, purchase-orders, outlets, reports
   - every settings tab
   - every `/capiche/*` and `/aiko/*` sub-page
   - login and offline
   - test in both light and dark themes
5. **Test as each role:** SUPER_ADMIN, OUTLET_MANAGER, HEAD_CHEF and VIEWER, because what each role sees differs.
6. **Overflow check on each page:** in the console, run `document.documentElement.scrollWidth <= innerWidth && document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth`. It must be `true`. Only intentional `overflow-x-auto` regions may scroll sideways.
7. **Interactions:**
   - The drawer closes after navigating.
   - Dialogs scroll with long content.
   - The date picker shows one month on mobile.
   - Tabs scroll sideways.
   - Sales cards expand to show items.
   - Sold-out and wastage edits save from their cards.
8. **Desktop regression:** at 1280px with a mouse, the layout matches `main` and no `pointer-coarse` sizing applies. Enable DevTools touch emulation to confirm the ~40px controls.
9. **Real devices:**
   - iOS Safari, plus the installed PWA: safe areas, no `100vh` jump, no zoom when focusing an input.
   - Android Chrome.
