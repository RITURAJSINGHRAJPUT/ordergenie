# OrderGenie

Centralized restaurant operations and analytics platform for Bookends Hospitality — aggregates Sales, Item Sales, Inventory, and Purchase Order data from Petpooja across all outlets into a single PostgreSQL database for fast dashboards and reporting.

Monorepo: `backend/` (Express + TypeScript + Prisma + PostgreSQL) and `frontend/` (Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui).

## Prerequisites

- Node.js >= 20
- A local PostgreSQL server (this project was set up against a locally-installed Postgres, not Docker)

## Setup

```bash
# 1. Create the database
createdb ordergenie
# or, if your Postgres requires a password/non-default user:
# psql -U postgres -c "CREATE DATABASE ordergenie;"

# 2. Install all workspace dependencies
npm install

# 3. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# edit backend/.env: set DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, and (optionally)
# the Petpooja credentials — see "Petpooja integration" below.

# 4. Run migrations and seed data
npm run db:migrate
npm run db:seed

# 5. Start both apps (backend on :4201, frontend on :4200)
npm run dev
```

Seeded admin login is printed at the end of the seed script (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `backend/.env`, defaulting to a placeholder password — **change it after first login**).

## Project structure

```
backend/
  prisma/schema.prisma      # 11 PRD entities + PetpoojaApiConfig/SyncSchedule/NotificationSetting
  prisma/seed.ts            # Roles, admin user, known outlets, faker-generated demo data
  src/
    config/                 # env validation, Prisma client singleton, cron defaults
    middleware/              # JWT auth, role/outlet scoping, error handling
    routes/ controllers/     # one pair per module (auth, dashboard, sales, inventory, ...)
    services/
      petpooja/               # Petpooja HTTP client, per-API fetchers, response mappers
      sync/                    # per-module sync orchestration + SyncLog bookkeeping
      <module>/                # business logic per module (sales, inventory, outlet, ...)
    cron/                    # node-cron registration, reads schedule from SyncSchedule table

frontend/
  src/app/
    (auth)/login/            # login page
    (protected)/              # sidebar/header shell + one route per module
  src/components/            # shadcn/ui primitives + per-module components
  src/hooks/                 # TanStack Query hooks per module
  src/store/                 # Zustand: authStore (session), filterStore (outlet/date filters)
```

## Petpooja integration

Two Petpooja APIs are wired up for real, verified against live production data during development:

- **Sales/Orders** — `GET https://api.petpooja.com/V1/thirdparty/generic_get_orders/` (sends a JSON body on a GET request — non-standard but required by Petpooja; the backend uses axios, not `fetch`, because `fetch` refuses bodies on GET). Returns the **previous day's** data relative to the `order_date` sent.
- **Purchase** — `POST https://api.petpooja.com/V1/thirdparty/get_purchase/` (note: **not** `inventory.petpooja.com` as an early support email stated — that host 404s; `api.petpooja.com` is correct). Enforces a maximum 1-month date range per call (the sync services chunk automatically). Its response also carries internal **inventory transfer** records (flagged via `is_transfer_only`), which the sync service routes into `InventoryTransaction` rows automatically — a real Transfer feed, not just a stub.

Two Petpooja APIs remain **stubbed** because no endpoint has ever been documented or shared for them:

- Stock-level Inventory (opening/closing stock) — `src/services/petpooja/inventoryStockApi.service.ts`
- A dedicated Inventory Transfer API — `src/services/petpooja/transferApi.service.ts` (largely superseded by the real transfer data that rides on the Purchase API — see above)

Both stub files mirror the exact function signature of their real counterparts, so wiring in a real endpoint later is a one-file change with no ripple into `src/services/sync/*`.

Credentials are stored encrypted in the `PetpoojaApiConfig` table (editable via Settings → Petpooja API), falling back to `backend/.env` if no DB row is configured. **Never commit real credentials** — `backend/.env` and the `apidocs/` folder (source material with live secrets) are gitignored.

## Known gaps / follow-ups

- **Outlet list may be incomplete.** 18 outlets are seeded from confirmed Petpooja emails, but live sync traffic already surfaced at least one outlet name (`Ahmedabad store 2.0`) not in that list — expect to add outlets via Settings as they're confirmed.
- **Two Petpooja credential sets** were issued (Sales ~June, Purchase ~August) and are stored per-API-type; it's unconfirmed whether they're interchangeable.
- **Manual sync date windows** are fixed in `src/controllers/sync.controller.ts` (yesterday for Sales, trailing 7 days for Purchase/Transfer) — no UI for a custom range yet.
- **Auth guard is client-side only** (no Next.js `proxy.ts` / middleware), an accepted simplification for this internal tool — every API route still enforces its own JWT + role/outlet check server-side regardless of what the UI shows.
- PWA background sync is a lightweight best-effort hook (`public/sw.js`), not a durable offline write queue — this stack has no Redis/queue infra per the PRD.

## Local dev verification

```bash
npm run db:studio      # inspect seeded/synced data
```

Smoke-test checklist:
- [ ] Login with the seeded admin, dashboard KPIs/charts render
- [ ] Sales / Item Sales / Inventory / Purchase Orders / Outlets pages load with working filters
- [ ] Reports page downloads CSV/Excel/PDF for all 6 report types
- [ ] Settings → Petpooja API shows Sales/Purchase as configured, Inventory/Transfer as not
- [ ] Settings → Sync Schedule "Run Now" triggers a real sync and the log appears below
- [ ] An Outlet Manager test user only sees their assigned outlet everywhere, and Settings is hidden
- [ ] `npm run build -w frontend && npm run start -w frontend` — manifest/icons/offline route all serve correctly
