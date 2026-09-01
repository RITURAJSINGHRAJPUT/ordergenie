# Lock outlet-scoped users to their own brand (+ Head Chef Wastage page)

## Context

A HEAD_CHEF assigned to **Capiche (Vesu)** still saw an **AIKO** section in the sidebar and could open
`/aiko/sold-out` — it rendered "All Aiko Outlets · 0 outlets" instead of being blocked. The nav was a
hardcoded static list (`NAV_ITEMS`) containing both brand sections, and nothing filtered it by the
user's assigned outlet. Data was never exposed (`scopeToOutlet` already forces `outletId` to the
caller's outlet, which is why the Aiko card said 0 outlets) — it was a UI/routing gap.

Required behaviour: a Capiche-assigned user sees **nothing** of Aiko — no nav section, no page.
Their whole app is **Dashboard → Capiche → Reconciliation, Sold Out, Wastage Management**, and the
reverse for an Aiko-assigned user. Head Chef gets Wastage as **view + add, no delete**.

## What was built

### Allowed brands come from the outlets the user can already see
`useOutlets()` hits `GET /outlets`, which the backend already scopes per role — one outlet for
HEAD_CHEF/OUTLET_MANAGER, all for ADMIN/MANAGEMENT/VIEWER. `frontend/src/hooks/useVisibleNav.ts`
turns that into `allowedBrands` (`null` = unrestricted) and returns the user's nav plus an `isReady`
flag. Deriving it here rather than from the auth payload means sessions already signed in are correct
without re-logging in — the persisted `ordergenie-auth` user object predates this and has no brand.

### One allowlist drives both the nav and the router
`frontend/src/components/layout/nav-items.ts`:
- `NavItem.brand` marks the two brand sections (matching on a field, not the label).
- `HEAD_CHEF_LABELS` now `{Reconciliation, Sold Out, Wastage Management}`.
- `visibleNavItems({ role, allowedBrands })` folds together the head-chef allowlist, the `adminOnly`
  filter (incl. the VIEWER-sees-Settings exception that used to be inline in `Sidebar.tsx`), and the
  new brand filter.
- `isRouteAllowed(pathname, items)` is the routing half of the same list. Leaf hrefs match by prefix
  (`/settings` must admit `/settings/users`); brand roots match **exactly** — treating `/capiche` as a
  prefix would have handed a head chef every page under the brand.

`ProtectedLayout` redirects to `/dashboard` when `isRouteAllowed` is false, but only once `isReady`,
so an in-flight outlets query can't bounce a legitimate page. This replaces the narrower non-admin
`sales-api` redirect that lived in `BrandSectionLayout`. Brand roots (`/capiche`, `/aiko`) now forward
via `BrandIndexRedirect` to the first page that role may open — Overview normally, Reconciliation for
a Head Chef.

### Backend: Wastage opened to Head Chef, two scope holes closed
`wastage.routes.ts` — HEAD_CHEF added to the router-level gate, and the single `canWrite` split into
`canCreate` (+HEAD_CHEF) and `canDelete` (unchanged).

Two pre-existing holes fixed while granting that access, both via `outletRestrictionFor()` (`utils/authz.ts`):
- `createWastageHandler` read `outletId` from the **body**, which `scopeToOutlet` never rewrites (it only
  touches query params) — an outlet-scoped caller could log wastage against any outlet by editing the
  payload. The caller's own outlet is now forced over whatever the body sends.
- `deleteWastageEntry` deleted by bare id with no scope check — it now 404s on another outlet's row.

`BrandWastageTab.tsx` keeps the report form on `!isViewer` (Head Chef now sees it) and moves the row
delete button to a `canDelete` check that also excludes HEAD_CHEF.

### Out of scope
ADMIN / MANAGEMENT / VIEWER are unchanged — unrestricted brands, same nav, same routes. No schema
change, no migration, no new endpoint. Dashboard content was already outlet-scoped.

## Files touched
- `backend/src/routes/wastage.routes.ts`, `backend/src/controllers/wastage.controller.ts`,
  `backend/src/services/wastage/wastage.service.ts`
- `frontend/src/components/layout/nav-items.ts`, `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/hooks/useVisibleNav.ts` (new), `frontend/src/components/brand-workspace/BrandIndexRedirect.tsx` (new)
- `frontend/src/app/(protected)/layout.tsx`, `frontend/src/app/(protected)/{capiche,aiko}/page.tsx`
- `frontend/src/components/brand-workspace/BrandSectionLayout.tsx`, `.../BrandWastageTab.tsx`

## Follow-up: query cache leaked across user switches

Right after this shipped, the Aiko (Surat) head chef showed a **CAPICHE** sidebar section. The brand
lock was not at fault — it rendered exactly what `GET /outlets` returned, and the production assignment
was correct. The dashboard gave it away: **₹11,49,122 / 381 orders** is month-to-date for **Capiche Uni**,
not Aiko (Surat) (₹10,23,708 / 292).

Root cause: `providers.tsx` creates one `QueryClient` per app mount, and both logout
(`Sidebar.handleLogout` → `router.replace('/login')`) and login (`LoginPage` → `router.replace('/dashboard')`)
are client-side navigations with no reload. Nothing cleared the cache in between, so signing out of one
account and into another in the same tab handed the previous user's `['outlets']`, `['dashboard']`,
`['reconciliation']`, sales — everything — to the next one. A cross-user leak inside a tab; the nav change
only made it visible by keying the sidebar off the outlets query. (The `api-client` 401 path escaped it —
it uses `window.location.href`, a full reload.)

Fix: `frontend/src/components/shared/AuthCacheReset.tsx`, mounted in `providers.tsx`, watches
`useAuthStore(s => s.user?.id)` and calls `queryClient.clear()` plus `useFilterStore.reset()` whenever a
signed-in identity changes. One choke point instead of per-call-site discipline — the 401 interceptor lives
outside React and can't reach the QueryClient anyway. The first `undefined → id` transition (fresh tab,
rehydration) is deliberately skipped so the first page's in-flight requests aren't cancelled; logout clears,
which is what makes the subsequent login clean. `filterStore` gained a `reset()` so a previously selected
outlet doesn't carry over either.

## Verification (done)
- `tsc --noEmit` clean both sides; `npm run build` clean on frontend.
- Access matrix exercised directly against `visibleNavItems`/`isRouteAllowed`:
  - HEAD_CHEF (Capiche) — nav `Dashboard | Capiche[Reconciliation, Sold Out, Wastage Management]`;
    blocked: `/capiche/sales`, `/capiche/sales-api`, `/aiko*`, `/purchase-orders`, `/outlets`, `/settings/*`.
  - OUTLET_MANAGER (Aiko) — Aiko section only, all `/capiche/*` blocked, settings blocked.
  - ADMIN — nothing blocked. VIEWER — unchanged except `/capiche/sales-api` correctly blocked.
- Live HTTP against the local dev DB with a HEAD_CHEF token (test row cleaned up):
  - `GET /api/outlets` → Capiche Ambli only. `GET /api/wastage` → 200 (was 403).
  - `POST /api/wastage` with an **Aiko** outletId in the body → row written against **Capiche Ambli**.
  - `DELETE /api/wastage/:id` as HEAD_CHEF → 403; as an OUTLET_MANAGER of a different outlet → 404;
    as the owning outlet's manager → 200.
