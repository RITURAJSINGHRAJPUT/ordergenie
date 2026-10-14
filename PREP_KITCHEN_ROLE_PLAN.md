# A Prep Kitchen role that sees only PO Lookup

## Context

PO Lookup tells each city's prep kitchen what to produce. The kitchen team needs a login of their
own — one that opens on that page and reaches nothing else.

Decided with the user: the role is **`PREP_KITCHEN`, shown as "Prep Kitchen"**, and it sees **both
cities**, exactly as the page works today.

The audit turned up three places where a new role is **fail-open**, and they matter more than the
role itself:

1. **Six endpoints have no role check at all** — any signed-in user reaches them:
   `GET /api/auth/me`, `/api/dashboard`, `/api/outlets`, `/api/reconciliation`, `/api/sold-out`,
   and `GET|PUT /api/settings/notifications`. Worse, `scopeToOutlet` only pins OUTLET_MANAGER and
   HEAD_CHEF, so a new role would read **every outlet's** reconciliation unscoped.
2. **`visibleNavItems` defaults to the full nav** — `role === 'HEAD_CHEF' ? filterForHeadChef(...) : NAV_ITEMS`.
   Any other role gets Dashboard, both brands, Sales, Inventory, Purchase Orders, Outlets, Reports.
3. **`allowedSettingsTabsFor` ends in `return ['/settings/notifications']`**, so an unrecognised role
   inherits a Settings tab that actually works.

And a trap: login, `app/page.tsx` and the protected layout's "not allowed" fallback all hard-code
`/dashboard`. For a role without Dashboard the guard redirects to a page it then rejects — a loop
that never leaves, while the Dashboard page loads real data from the unguarded endpoint.

## Backend

- **Enum + migration**: `PREP_KITCHEN` in `RoleName`, and a migration folder containing
  `ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'PREP_KITCHEN';`, following
  `20260910140000_add_super_admin_and_page_grants`.
- **`prisma/seed.ts`**: a `ROLE_DESCRIPTIONS` entry — "Prep kitchen team: the PO Lookup prep list
  only". The map is `Record<RoleName, string>`, so the compiler insists on it, and seeding creates
  the `Role` row that the Users dropdown reads.
- **`routes/poLookup.routes.ts`**: add `RoleName.PREP_KITCHEN` to the router's `requireRole`.
- **`middleware/rbac.middleware.ts`** — a new `restrictedRoleGuard`, mounted once in `app.ts` ahead
  of the API router: a map of role → allowed path prefixes, with `PREP_KITCHEN: ['/api/auth', '/api/po-lookup']`.
  Everything else 403s. Deny-by-default in one place, rather than patching the five unguarded
  routers and hoping the next route added remembers. Roles absent from the map are unaffected, so
  nothing changes for existing users.

## Frontend

- **`types/api.ts`**: widen the `Role` union with `'PREP_KITCHEN'`.
- **`components/layout/nav-items.ts`**: replace the fail-open ternary with an explicit map of
  restricted roles to the labels they may see — `HEAD_CHEF` keeps its current list, `PREP_KITCHEN`
  gets `['PO Lookup']`. Both `visibleNavItems` and `isRouteAllowed` key off the result, so the
  sidebar and the route guard stay in step.
- **Landing path**: a `landingPathFor(role)` helper — `/po-lookup` for PREP_KITCHEN, `/dashboard`
  otherwise — used by the login redirect, the already-signed-in redirect and `app/page.tsx`. The
  protected layout's fallback becomes `items[0]?.href ?? '/login'` so it can never bounce a user to
  a page their own nav rejects.
- **`settings/layout.tsx`**: an explicit `if (user.role === 'PREP_KITCHEN') return [];` before the
  fall-through, so the role can't inherit the Notifications tab.
- Nothing else needs touching: the alerts bell is SUPER_ADMIN-only, the closing overlay is for the
  two outlet roles, and the Users screen picks the new role up from the database on its own.

## Verification

The local Postgres needs sudo to start, so the API is tested against the stubbed-Prisma harness in
the session scratchpad, as with the last few changes.

1. `tsc --noEmit` both workspaces, `npm run build` on the frontend.
2. As PREP_KITCHEN: `GET /api/po-lookup` and its `/pdf` return 200, and **403 on every one of**
   `/api/dashboard`, `/api/outlets`, `/api/reconciliation`, `/api/sold-out`,
   `/api/settings/notifications`, `/api/sales`, `/api/purchase-orders`, `/api/activity-logs` —
   the four unguarded ones being the point of the exercise. `GET /api/auth/me` still works.
3. Every existing role is unchanged: spot-check SUPER_ADMIN, HEAD_CHEF and VIEWER against the same
   endpoints and confirm the answers match today's.
4. `visibleNavItems({ role: 'PREP_KITCHEN' })` yields exactly `['PO Lookup']`, `isRouteAllowed`
   agrees for `/po-lookup` and refuses `/dashboard`, `/sales` and `/settings`, and
   `allowedSettingsTabsFor` returns `[]`.
5. `landingPathFor('PREP_KITCHEN')` is `/po-lookup`, and `/dashboard` for the rest.
