# Plan: Merge frontend + backend into a single Render service

Status: **Implemented** (2026-08-13) — `backend/src/combinedServer.ts` exists, `app.ts`/`server.ts` are split as described below, `backend/package.json` has `next` + `start:combined`, and `HOSTING.md` documents the single-service deploy (including the `ordergenie.bookends.co.in` custom domain). Verified locally: built both workspaces, ran `NODE_ENV=production node dist/combinedServer.js`, confirmed `/health`, `/api/auth/login`, `/`, and `/dashboard` all resolve correctly through the one process. Actually deploying to Render and pointing DNS at it are manual steps for whoever holds those accounts — not something achievable from this environment.

## Context

`HOSTING.md` currently documents deploying OrderGenie as **two** separate Render Web Services (backend + frontend), each with their own URL, connected via `CORS_ORIGIN`/`NEXT_PUBLIC_API_URL`. The goal is to collapse this into **one** Render service — one URL, one bill, one thing to give Petpooja for the webhook — instead of two. This is a real architecture change (a combined Node process serving both the API and the web app), not just a deployment-doc tweak.

Confirmed this is a well-supported pattern: Next.js 16's own docs (`node_modules/next/dist/docs/01-app/02-guides/custom-server.md`) document exactly this — `next({dev, dir})` + `app.getRequestHandler()` — as the supported way to embed Next.js inside an existing Node/Express backend. The only hard constraint is that `next.config.ts` must **not** set `output: 'standalone'` (custom servers and standalone output are mutually exclusive) — confirmed it currently doesn't.

**Local dev is unaffected** — it stays exactly as-is (`npm run dev` at root, two separate processes on :4200/:4201 via `concurrently`, full hot reload). This combined server is a new, additional **production-only** entrypoint used solely for the single-Render-service deployment; nothing about the day-to-day dev workflow changes.

## Approach

### 1. Split `notFoundHandler`/`errorHandler` out of the shared Express app
`backend/src/app.ts` currently ends with `app.use(notFoundHandler); app.use(errorHandler);` — a hard 404 for anything outside `/api`. The combined server needs that fallback to go to Next.js instead. Move those two lines out of `app.ts` into `server.ts` (the existing standalone-backend entrypoint, used for local dev and any future backend-only deploy) so its behavior is 100% unchanged. `app.ts` itself then just exports the bare app (cors, json, `/health`, `/api` routes) with no opinion on what happens after.

### 2. New `backend/src/combinedServer.ts`
```ts
import next from 'next';
import path from 'path';
import { env } from './config/env';
import { app } from './app';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { registerAllJobs } from './cron';
import { wireCronJobHandlers } from './cron/jobs';

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: path.join(__dirname, '../../frontend') });
const handle = nextApp.getRequestHandler();

wireCronJobHandlers();

nextApp.prepare().then(async () => {
  app.use((req, res) => handle(req, res)); // anything not matched by /health or /api routes
  app.use(errorHandler);

  app.listen(env.PORT, async () => {
    logger.info(`OrderGenie combined server listening on port ${env.PORT}`);
    await registerAllJobs();
  });
});
```
`path.join(__dirname, '../../frontend')` resolves correctly at runtime: compiled output lands at `backend/dist/combinedServer.js` (confirmed via `tsconfig.json`'s `outDir: "dist"`), so `../../frontend` from `backend/dist/` reaches `<repo-root>/frontend`. Requires a pre-built `frontend/.next` (via `next build`) since `dev: false` in production — that becomes part of the Render build step (§4).

### 3. `backend/package.json`
- Add `"next": "^16.3.0"` as a dependency (matches frontend's version) — it's already present in `node_modules` via workspace hoisting, but backend now imports it directly and should declare it explicitly rather than relying on a phantom hoisted dependency.
- Add script: `"start:combined": "node dist/combinedServer.js"`.

### 4. `HOSTING.md` — replace the two-service section with one
- **One Render Web Service** (not two), root directory blank (monorepo).
- **Build Command**: `npm install && npm run build -w frontend && npm run build -w backend`
- **Start Command**: `npm run start:combined -w backend`
- **Environment variables**: same backend vars as before (`DATABASE_URL`, `JWT_*`, `ENCRYPTION_KEY`, `PETPOOJA_*`, `SEED_ADMIN_*`, `PORT` left unset/Render-injected), plus `NEXT_PUBLIC_API_URL=/api` — a **relative** path now, since frontend and backend share one origin. This must be set before the build step runs (`NEXT_PUBLIC_*` vars are inlined into the frontend bundle at `next build` time, same constraint already noted elsewhere in this doc for the old two-service setup). `CORS_ORIGIN` becomes moot (same-origin requests don't trigger CORS at all) — leave it unset/default, no longer needs to reference a separate frontend URL.
- One URL for everything: post-deploy verification, Petpooja webhook registration (`https://<service>.onrender.com/api/webhooks/petpooja/purchase-order`), and the site itself all use the same domain.
- Instance type: must be Starter+ (not Free) — unchanged reasoning from before (cron jobs need an always-on process), but now it's a **single** Starter service instead of backend-Starter + frontend-Free/Starter, which is the cost win driving this change.
- Note the tradeoff plainly: frontend and backend now share one process — if either half crashes or hangs, both go down together (including the sync cron jobs), and they can no longer be scaled independently. Acceptable for this app's current scale, but worth stating explicitly rather than silently losing the isolation the two-service setup had.

## Verification (once implemented)

1. Locally: `npm run build -w frontend && npm run build -w backend`, then `NODE_ENV=production PORT=5050 node backend/dist/combinedServer.js` (with real env vars loaded) — confirm the server boots, cron jobs register, `GET /health` and `GET /api/...` (e.g. login) work, and visiting `/` in a browser actually renders the Next.js app (not a 404) — proving the Next.js fallback wiring is correct before ever touching Render.
2. Confirm `/dashboard` loads real data end-to-end through the combined server (frontend calling `/api/...` as a relative path, same origin).
3. Deploy to Render per the updated `HOSTING.md`, then repeat the existing post-deploy checklist (login, manual sync, webhook registration with Petpooja using the single URL).
