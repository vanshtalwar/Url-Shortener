# Context

Running summary of project state. Updated after every change.

## Project
URL shortener with click analytics. Angular 14 frontend (Vercel), Express + TypeScript backend (Render), MongoDB Atlas, Google OAuth. v1 also includes bot filtering, unique visitors, edit/delete, QR codes, rate limiting. Full plan: [PLAN.md](PLAN.md) (10 build steps).

## Current status
- Assumptions 1–10 confirmed by user.
- Steps 1–10: ✅ built. Audit fixes (2026-11-22) applied locally: backend 75 tests pass; frontend `ng build` clean (initial bundle 349 kB, stats page lazy).
- ⚠️ PENDING (needs user go-ahead): push audit fixes → wait for Render deploy → run Atlas migration (`ts`→`clickedAt` etc., script tested; dry run on Atlas: 1 click, 1 link, 1 user, 2 old indexes) → user runs TRUST_PROXY_HOPS hotspot test (README).
- 🎉 v1 live end to end. Remaining items:
  - Review the build (incl. "Decisions made during build" below).
  - `backend/.env` created: Atlas URI (cluster0.1kjtoqy, db `url-shortener`), generated JWT_SECRET + VISITOR_HASH_SALT. Atlas connection ✅ verified. Google Client ID ✅ set in `.env` and both frontend environment files (public value, safe to commit).
  - Local run ✅ confirmed working by user (2026-11-21).
  - Atlas Network Access opened for Render (done by user 2026-11-21).
  - Initial commit made (author Vansh Talwar, no Claude co-author — user rule). Remote: https://github.com/vanshtalwar/Url-Shortener.git. Pushed ✅ (`c6fff9c`, private repo, `main` tracks `origin/main`; gh logged in as vanshtalwar).
  - Render backend ✅ live: https://url-shortener-z283.onrender.com (manual Web Service, root `backend`; /health 200, DB reachable). `apiUrl` set in environment.prod.ts.
  - Vercel frontend ✅ live: https://url-shortener-phi-kohl.vercel.app (root `frontend`, no env vars). SPA rewrite + prod bundle verified.
  - Render `FRONTEND_ORIGIN` = Vercel URL ✅; Google origin added ✅. Live app ✅ confirmed working by user (sign-in → /links).

## Backend layout (`backend/`)
- `src/config.ts` — `loadConfig(env)` (pure, frozen, validated at startup) + `config`. Required: `FRONTEND_ORIGIN`, `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `VISITOR_HASH_SALT`. Optional: `PORT`, `TRUST_PROXY_HOPS` (1), `LOGIN_RATE_LIMIT` (10/15min), `LINK_WRITE_RATE_LIMIT` (30/15min), `REDIRECT_RATE_LIMIT` (120/min).
- `src/app.ts` — `createApp({ verifyGoogleToken?, rateLimits?, trustProxyHops? })`: no X-Powered-By, trust proxy, CORS, JSON, `/health`, `/api/auth`, `/api/links` (mounted with `requireAuth` then write limiter), redirect router last. Error handler: 4xx passthrough, else 500.
- `src/server.ts` — connect, listen, graceful shutdown on SIGTERM/SIGINT (close server, disconnect Mongo).
- `src/middleware/auth.ts` — `signToken` (7d), `requireAuth` → `res.locals.userId`.
- `src/middleware/rateLimit.ts` — `createLimiters(limits)`; link-write limiter skips GET and throws if used before `requireAuth`.
- `src/routes/auth.ts` — `POST /api/auth/google`; one shared `OAuth2Client` (caches Google certs).
- `src/routes/links.ts` — `router.param('id')` loads caller's own link (404 otherwise); POST (alias → 409 if taken; random code retried ×3), GET list (click counts via aggregation), PATCH (partial, `findByIdAndUpdate`), GET `/:id/stats`, DELETE (link first, then clicks).
- `src/routes/redirect.ts` — `GET /:code`: 404 / 410 / record click (GET only; HEAD not counted) / 302. 2 DB round trips.
- `src/linkInput.ts` — `parseLinkInput(body, 'create'|'update', now)` pure validation; URL ≤ 2048 chars.
- `src/shortCode.ts` — `randomCode()` (7 chars). `src/visit.ts` — `describeVisit(request, salt)` pure UA/referrer/hash parsing.
- `src/stats.ts` — `linkStats(id, includeBots, today)` (one `$facet` incl. bot count), `humanClickCounts(ids)`, pure `fillDays(days, today)`.
- Models: User (googleId, email), Link (owner, code unique, url, expiresAt; index owner+createdAt+_id), Click (link, clickedAt, referrer, browser, os, deviceType, isBot, visitorHash; index link+isBot).
- `tests/` — 9 suites, 75 tests. `env.ts` sets env before config loads; `helpers.ts`: `useTestDb`, fake Google (`good:<name>`), `loginAs`, `listedClickCount`.
- Scripts: `dev` (tsx watch), `build`, `start`, `typecheck`, `test`. Express 5, Mongoose 8, TS 5, Jest 29.

## Decisions made during build (not explicitly asked — review these)
- Referrer stored as hostname only (e.g. `google.com`), not full URL; empty = "direct".
- Dashboard `clickCount` = human clicks only, computed from clicks on each list load (stored counter removed in audit fixes: it could drift).
- Clicks-per-day fills days with 0 from the first click to today (UTC), so the chart has no gaps.
- Alias/code uniqueness is case-sensitive (`Abc` ≠ `abc`), but reserved words are checked case-insensitively because Express routes are case-insensitive.
- `ua-parser-js` pinned to v1 (MIT); v2 is AGPL.
- Frontend generated with `--skip-tests` (no Karma spec files); UI is verified manually per plan.
- Unreadable User-Agents (no OS) stored as deviceType `unknown`; HEAD requests redirect but aren't clicks.
- User `name` no longer stored/returned (was unused).
- JWT + user stored in `localStorage` (simple; readable by any XSS on the page — acceptable for v1, no third-party scripts besides Google's).
- App name shown in UI/title: "Shortly".
- Frontend `@types/node` pinned to 16: the latest (26) breaks TypeScript 4.7.
- Links table shows the alias/code as the link text (full short URL on copy/QR); one row editable at a time.
- Stats response includes a `link` summary (id, code, url, expiresAt) so the detail page needs one request.
- Stats page lazy-loaded (chart.js out of the initial bundle: 512 → 349 kB); bundle budget back to Angular's 500kb default.
- Angular test scaffolding removed (user request): no frontend unit-test setup. `karma` still appears in package-lock.json only as a peer/dependency of `@angular-devkit/build-angular` (dev-only, not in the bundle).

## Frontend layout (`frontend/`, Angular 14, Node 16 via `.nvmrc`)
- `src/environments/` — `apiUrl`, `googleClientId`.
- `src/app/auth/` — `AuthService` (user cached in memory, corrupted storage → logged out, `isLoggedIn` checks JWT `exp`, `clearSession`/`logout`), `AuthGuard` (clears expired session), `AuthInterceptor` (token only for exact API origin; 401 → logout), `GoogleSignInService` (loads + initializes GSI script once; `credential$`).
- `src/app/pages/login/` — subscribes to `credential$` until destroyed, renders button.
- `src/app/links.service.ts` — types (`Link`, `LinkSummary`, `LinkStats`, `LinkInput`), `LinksService`, pure `shortUrl`, `isExpired(expiresAt, now)`.
- `src/app/pages/links/` — `LinksComponent` (list, inline edit sending only changed fields, copy with "Copied!", delete, trackBy), `LinkCreateFormComponent`, `QrPanelComponent`, `form-utils.ts`.
- `src/app/pages/link-detail/` — lazy `LinkDetailModule`; `switchMap` drops stale responses, `takeUntil` cancels on leave; chart colour from `--accent`.
- Routes: `/login`, `/links`, `/links/:id` (lazy; both guarded), `**` → `/links`.
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
- 2026-11-21 — Pushed `main` to GitHub (private). Verified: remote HEAD = local `c6fff9c`, author Vansh Talwar, no co-author/Claude text, 72 files, no `.env`/node_modules/dist.
- 2026-11-21 — Backend deployed on Render (user, manual Web Service form instead of Blueprint). Verified live: /health 200, /api/links 401, unknown code 404. Set production `apiUrl`; prod bundle checked (Render URL, no localhost).
- 2026-11-21 — Frontend deployed on Vercel. Verified: / and /links 200, bundle points at Render. Render CORS still `http://localhost:4200` → user updating FRONTEND_ORIGIN.
- 2026-11-21 — Live app confirmed working by user. Verified Render CORS preflight (PATCH + Authorization) allows the Vercel origin. All 10 steps done.
- 2026-11-21 — Removed unused frontend test setup: karma.conf.js, tsconfig.spec.json, src/test.ts, angular.json `test` target, `test` script, 7 Karma/Jasmine devDependencies, VS Code `ng test` launch/task, README test sections. ng build clean, same bundle size.
- 2026-11-22 — Full adversarial audit (H1–H2, M1–M6, L1–L11), then all fixes applied. Backend: config validated/frozen + env-tunable proxy hops & rate limits; redirect 3→2 DB trips, stored clickCount removed (computed); shared OAuth2Client; duplicate-key handling moved into links routes with random-code retry; limiter policy in one place + fails loudly; router.param ownership; pure validation/visit/fillDays; HEAD not counted; unknown devices; URL length cap; graceful shutdown; X-Powered-By off; compound indexes; renamed ts→clickedAt, os→operatingSystems; removed unused name/includeBots/createdAt/exports. Frontend: edit sends only changed fields (H2), stats switchMap/takeUntil (M3), GSI loaded once (M4), components split, lazy stats page, JWT expiry check, cached user, exact-origin interceptor, copy feedback, trackBy. Verified: 75 tests ×3, ng build clean, built server smoke test (incl. SIGTERM exit 0), migration tested on old-format data (idempotent) + read-only dry run on Atlas. User's local `npm run dev` auto-reloaded the new code and created the new indexes on Atlas (harmless). Not yet pushed/deployed/migrated.
