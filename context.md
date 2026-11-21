# Context

Running summary of project state. Updated after every change.

## Project
URL shortener with click analytics. Angular 14 frontend (Vercel), Express + TypeScript backend (Render), MongoDB Atlas, Google OAuth. v1 also includes bot filtering, unique visitors, edit/delete, QR codes, rate limiting. Full plan: [PLAN.md](PLAN.md) (10 build steps).

## Current status
- Assumptions 1–10 confirmed by user.
- Steps 1–10: ✅ built. Backend: 48 tests pass. Frontend: `ng build` clean (Node 16, also tested on 22 and 24).
- Waiting on user (see README):
  - Review the build (incl. "Decisions made during build" below).
  - `backend/.env` created: Atlas URI (cluster0.1kjtoqy, db `url-shortener`), generated JWT_SECRET + VISITOR_HASH_SALT. Atlas connection ✅ verified. Google Client ID ✅ set in `.env` and both frontend environment files (public value, safe to commit).
  - Local run ✅ confirmed working by user (2026-11-21).
  - Atlas Network Access opened for Render (done by user 2026-11-21).
  - Initial commit made (author Vansh Talwar, no Claude co-author — user rule). Remote: https://github.com/vanshtalwar/Url-Shortener.git. Push pending: user installing `gh` + `gh auth login`.
  - Then: Render → set `apiUrl` in environment.prod.ts → Vercel → FRONTEND_ORIGIN + Google origin (README §4).

## Backend layout (`backend/`)
- `src/config.ts` — env vars (`PORT`, `FRONTEND_ORIGIN`, `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `VISITOR_HASH_SALT`); `.env` loaded via dotenv.
- `src/app.ts` — `createApp()`: trust proxy, CORS, JSON body, `GET /health`. Kept separate from server so tests use it without a DB connection or open port.
- `src/server.ts` — connects Mongoose, then listens.
- `src/models/user.ts` — User (googleId unique, email, name).
- `src/middleware/auth.ts` — `signToken`, `requireAuth` (Bearer JWT, 7 days → `res.locals.userId`).
- `src/routes/auth.ts` — `POST /api/auth/google`; Google check is injectable via `createApp({ verifyGoogleToken })`.
- `src/models/link.ts` — Link (owner, code unique, url, expiresAt, clickCount = human clicks), `serializeLink`.
- `src/routes/links.ts` — `POST/GET /api/links`, `PATCH/DELETE /api/links/:id`; alias/URL/expiry validation; `findOwnedLink` returns null for other users' links (→ 404).
- `src/models/click.ts` — Click (link, ts, referrer hostname, browser, os, deviceType, isBot, visitorHash).
- `src/routes/redirect.ts` — `GET /:code`: 404 unknown, 410 expired, else record click and 302. Mounted last in `app.ts`. `VISITOR_HASH_SALT` env var.
- `src/stats.ts` — `linkStats(linkId, includeBots)`; served at `GET /api/links/:id/stats?bots=true` (response also includes `link`).
- `src/middleware/rateLimit.ts` — login 10/15min per IP, link writes 30/15min per user (all non-GET on /api/links), redirects 120/min per IP → 429.
- Error handler in `app.ts`: Mongo duplicate key → 409, 4xx passthrough, else 500.
- `tests/` — Jest + supertest (`npm test`). `tests/env.ts` sets test env vars; `tests/helpers.ts` has `useTestDb()` (in-memory Mongo), fake Google check (`good:<name>`), `loginAs()`.
- Scripts: `dev` (tsx watch), `build` (tsc → `dist/`), `start`, `typecheck`, `test`.
- Versions: Express 5, Mongoose 8, TypeScript 5, Jest 29, mongodb-memory-server (dev).

## Decisions made during build (not explicitly asked — review these)
- Referrer stored as hostname only (e.g. `google.com`), not full URL; empty = "direct".
- `Link.clickCount` (shown in the dashboard list) counts human clicks only; bots are in stats.
- Clicks-per-day fills days with 0 from the first click to today (UTC), so the chart has no gaps.
- Alias/code uniqueness is case-sensitive (`Abc` ≠ `abc`), but reserved words are checked case-insensitively because Express routes are case-insensitive.
- `ua-parser-js` pinned to v1 (MIT); v2 is AGPL.
- Frontend generated with `--skip-tests` (no Karma spec files); UI is verified manually per plan.
- JWT + user stored in `localStorage` (simple; readable by any XSS on the page — acceptable for v1, no third-party scripts besides Google's).
- App name shown in UI/title: "Shortly".
- Frontend `@types/node` pinned to 16: the latest (26) breaks TypeScript 4.7.
- Links table shows the alias/code as the link text (full short URL on copy/QR); one row editable at a time.
- Stats response now includes the `link` object (so the detail page needs one request, not the whole list).
- Angular initial bundle warning budget raised 500kb → 700kb (chart.js; ~144 kB gzipped). Alternative would be lazy-loading the detail page.
- Unused Angular test scaffolding left as generated (`karma.conf.js`, `tsconfig.spec.json`, Karma devDependencies) — remove if you don't plan frontend unit tests.

## Frontend layout (`frontend/`, Angular 14, Node 16 via `.nvmrc`)
- `src/environments/` — `apiUrl`, `googleClientId` (placeholders until user provides values).
- `src/app/auth/` — `AuthService` (login → JWT in localStorage, logout), `AuthInterceptor` (Bearer header on API calls; 401 → logout), `AuthGuard` (→ /login).
- `src/app/pages/login/` — loads Google Identity Services script, renders button, exchanges credential.
- `src/app/links.service.ts` — `LinksService` (list/create/update/remove), `shortUrl(code)` = `${apiUrl}/${code}`.
- `src/app/pages/links/` — create form (url, alias, expiry via datetime-local in user's timezone), table with Copy / QR / Edit (inline row) / Delete (confirm). Alias change asks for confirmation. QR panel with Download PNG (`qrcode`, allowed as CommonJS dep in angular.json).
- `src/app/pages/link-detail/` — `/links/:id`: stat tiles (clicks, uniques, bots), include-bots checkbox, clicks-per-day bar chart (chart.js, tree-shaken registration), referrer/browser/OS/device tables with %.
- Routes: `/login`, `/links`, `/links/:id` (both guarded), `**` → `/links`.
- Global styles in `src/styles.css` (CSS variables, card/table/button styles).
- Build: `nvm use && npx ng build`.

## Deployment
- `render.yaml` (repo root) — Render Blueprint for `backend/` (build `npm ci && npm run build`, health `/health`, generates JWT_SECRET + VISITOR_HASH_SALT, skips test MongoDB binary download).
- `frontend/vercel.json` — build `ng build`, output `dist/frontend`, SPA rewrite.
- Production values to fill: `frontend/src/environments/environment.prod.ts` (`apiUrl`, `googleClientId`); Render `FRONTEND_ORIGIN`.
- `backend/package.json` engines `node >=22`.

## Claude Code config
- `.claude/skills/karpathy-guidelines/SKILL.md` — copied (not linked) from `~/Developer/andrej-karpathy-skills` on 2026-11-21; re-copy to pick up upstream changes.
- Same rules also load from `Angular-Practise/CLAUDE.md` (user's copy) and the global `~/.claude/CLAUDE.md` import.

## Environment notes
- System Node: v26 (backend). Frontend needs Node 16 via nvm (Angular 14 doesn't support Node 26).
- MongoDB: Atlas (cloud) for real use; `mongodb-memory-server` for tests and local smoke checks.
- Secrets live in `backend/.env` (gitignored); `.env.example` documents the keys.
- npm 11 blocks dependency install scripts (e.g. esbuild postinstall); tsx still works without it.

## Change log
- 2026-11-21 — Created `url-shortener/`, `git init` (branch `main`), added PLAN.md, context.md, .gitignore.
- 2026-11-21 — PLAN.md: added bot filtering, unique visitors, edit/delete, QR codes, rate limiting, deployment (Render + Vercel) to v1.
- 2026-11-21 — Assumptions confirmed. PLAN.md regrouped into 10 build steps with status table.
- 2026-11-21 — Step 1 done: backend scaffold. Verified: `/health` test passes, `npm run typecheck` and `npm run build` clean, built server connected to a temporary MongoDB and `/health` returned 200.
- 2026-11-21 — Step 2 done: Google login + JWT. Added google-auth-library, jsonwebtoken. 8 tests pass.
- 2026-11-21 — Step 3 done: links create/list/edit/delete. 31 tests pass.
- 2026-11-21 — Step 4 done: redirect + click recording (bot flag via isbot, ua-parser-js v1 — MIT; v2 is AGPL), delete also removes clicks, list sort tiebreak on _id (one unexplained flaky run seen, not reproduced in 17 reruns). 40 tests pass.
- 2026-11-21 — Step 5 done: stats endpoint (single $facet aggregation + bot count). Added 'Decisions made during build' section. 45 tests pass.
- 2026-11-21 — Step 6 done: rate limiting (express-rate-limit 8, per-app in-memory stores, limits injectable via createApp({ rateLimits })). 48 tests pass.
- 2026-11-21 — Step 7 done: Angular 14 app (frontend/), auth service/interceptor/guard, Google login page. ng build passes. Manual sign-in check pending real Google Client ID.
- 2026-11-21 — Step 8 done: links page (create, list, inline edit, delete, copy, QR + PNG download). ng build passes. Smoke test of built backend with real HTTP: CORS preflight for PATCH OK, create 201, redirect 302, stats, delete 204. Manual UI check pending Google Client ID.
- 2026-11-21 — Step 9 done: link detail/analytics page, Stats button in links table, stats response includes link. Backend 48 tests pass; ng build clean.
- 2026-11-21 — Step 10 done: render.yaml, frontend/vercel.json, backend engines, README (setup, run, test, deploy, API, limits). Frontend build verified on Node 16, 22, 24. Live deploy pending user accounts.
- 2026-11-21 — Added project skill `.claude/skills/karpathy-guidelines/` (copy of upstream).
- 2026-11-21 — Created `backend/.env` (gitignored) from the Atlas URI the user had put in `.env.example`; restored `.env.example` placeholder so the password isn't committed. Connection test: cluster reachable + IP allowed; auth fails until `<db_username>` is replaced.
- 2026-11-21 — User filled in Atlas username. Verified: connects to db `url-shortener`; built server starts against Atlas and `/health` returns 200.
- 2026-11-21 — Google Client ID: removed stray `<` in `.env`, set in `environment.ts` + `environment.prod.ts`. Verified: Google recognises the client (fake ID → invalid_client); backend rejects forged token 401 with real config; ng build clean. Browser sign-in not yet tested (needs `http://localhost:4200` in Authorized JavaScript origins).
- 2026-11-21 — User confirmed the app works locally (Google sign-in + Atlas).
- 2026-11-21 — Initial commit on `main` (repo-local git identity set), remote `origin` added. User opened Atlas network access. Push waiting on GitHub auth.
