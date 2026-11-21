# URL Shortener with Click Analytics — Plan

## Decisions (confirmed by user)
| Area | Choice |
|---|---|
| Location | `Angular-Practise/url-shortener/` (own git repo). `hello-angular` untouched. |
| Frontend | Angular 14, run under Node 16 via nvm |
| Backend | Node + Express + TypeScript |
| Database | MongoDB Atlas, via Mongoose |
| Login | Google OAuth |
| Analytics | Total clicks, unique visitors, clicks per day, referrer, browser and device |
| Bots | Redirected and recorded with `isBot=true` (detected by User-Agent via `isbot`); excluded from stats by default |
| Unique visitors | Salted SHA-256 of IP + User-Agent stored per click (raw IP never stored); unique = distinct hashes |
| Features | Custom alias, dashboard of your links, user accounts, link expiry, edit, delete, QR codes |
| Edit | Owner can change destination URL, expiry, and alias/code (old short URL stops working; UI warns) |
| Delete | Hard delete: link and all its clicks removed; code becomes free |
| QR codes | Generated in the frontend with `qrcode`; shown in UI with "Download PNG" button |
| Rate limiting | `express-rate-limit`, in-memory: create/edit/delete 30 per 15 min per user; login 10 per 15 min per IP; redirects 120 per min per IP; over limit → 429 |
| Deployment | Backend on Render, frontend on Vercel, both deploy from GitHub |
| Tests | Jest + supertest API tests |

## Assumptions (confirmed by user 2026-11-21)
1. **Google login method:** Frontend uses Google's "Sign in with Google" button and receives an ID token. Backend verifies it with `google-auth-library`, creates the user if new, and returns its own JWT (valid 7 days). Frontend sends that JWT with every API call.
2. **Redirects come from the backend:** short links look like `https://<render-app>/abc123` (locally `http://localhost:3000/abc123`), served by Express, not Angular.
3. **Node versions:** backend runs on Node 26 locally (Render uses its Node 22 LTS, so no Node-26-only features); frontend has `.nvmrc` = 16.
4. **Random codes:** 7 characters (letters + digits), generated with Node's built-in `crypto`.
5. **Custom aliases:** 3–30 characters from `A-Z a-z 0-9 - _`, unique across all users; `api` and `health` are reserved.
6. **Expired links** return HTTP 410 (Gone); unknown codes return 404.
7. **Clicks per day chart** uses `chart.js` directly (no Angular wrapper). Days grouped in UTC.
8. **Tests** use `mongodb-memory-server` (never touch Atlas); Google token verification is faked.
9. **Stats show human clicks by default** with a toggle to include bots; the bot count is always shown separately.
10. **Editing an alias keeps the link's click history** (same link record, new code).

## Structure
```
url-shortener/
  PLAN.md
  context.md
  backend/   src/{app.ts, server.ts, models/, routes/, middleware/{auth.ts, rateLimit.ts}}, tests/, .env.example
  frontend/  Angular 14: pages login, links, link-detail; auth guard + interceptor; services; vercel.json
```

## Data model
- **User:** `googleId` (unique), `email`, `name`
- **Link:** `owner`, `code` (unique), `url`, `expiresAt?`, `clickCount`, `createdAt`
- **Click:** `link` (indexed), `ts`, `referrer`, `browser`, `os`, `deviceType` (parsed with `ua-parser-js`), `isBot`, `visitorHash`

## API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/google` | – | `{credential}` → `{token, user}` |
| POST | `/api/links` | JWT | `{url, alias?, expiresAt?}` → link |
| GET | `/api/links` | JWT | List my links with click counts |
| PATCH | `/api/links/:id` | JWT (owner) | Change `url`, `alias`, `expiresAt` (null removes expiry) |
| DELETE | `/api/links/:id` | JWT (owner) | Delete link and its clicks → 204 |
| GET | `/api/links/:id/stats?bots=true` | JWT (owner) | Total, unique visitors, bot count, clicks per day, top referrers, browser/device breakdown |
| GET | `/:code` | – | Record click, then 302 redirect, or 404/410 |
| GET | `/health` | – | 200 OK |

A link owned by another user returns 404 (not 403), so link IDs can't be probed.

## Build steps (10)
| # | Step | Status |
|---|---|---|
| 1 | Backend scaffold | ✅ |
| 2 | Google login + JWT | ✅ |
| 3 | Links: create, list, edit, delete | ✅ |
| 4 | Redirect + click recording | ✅ |
| 5 | Stats endpoint | ✅ |
| 6 | Rate limiting | ✅ |
| 7 | Frontend scaffold + login page | ✅ |
| 8 | Links page (create, table, edit, delete, QR) | ✅ |
| 9 | Link detail / analytics page | ✅ |
| 10 | Deployment + README | ✅ config + README · ⏳ live deploy needs your accounts |

### 1. Backend scaffold
TypeScript, Express, Mongoose, `.env` config, CORS for the frontend origin, `trust proxy` (for Render), Jest + supertest setup, `GET /health`.
→ verify: `/health` test passes; `npm run build` compiles; server starts against a real MongoDB.

### 2. Google login + JWT
`User` model, `POST /api/auth/google`, JWT auth middleware, test DB helper (`mongodb-memory-server`).
→ verify: tests (faked Google check): valid token → JWT + user created once; bad token → 401; protected route without/with bad JWT → 401.

### 3. Links: create, list, edit, delete
`Link` model, random code, alias rules, URL validation, expiry; `POST/GET /api/links`, `PATCH/DELETE /api/links/:id`.
→ verify: tests: valid URL 201, invalid URL 400, duplicate alias 409, reserved alias 400, list returns only my links; owner edits URL/expiry/alias; other user 404; delete → 204.

### 4. Redirect + click recording
`Click` model, `GET /:code`, User-Agent parsing, bot flag (`isbot`), salted visitor hash, expiry check; delete also removes clicks.
→ verify: tests: 302 with correct `Location`; click saved with referrer/browser/device; bot UA → `isBot=true`; same IP+UA → same hash and raw IP not stored; unknown 404; expired 410; deleted link's clicks gone.

### 5. Stats endpoint
`GET /api/links/:id/stats?bots=true`: total, uniques, bot count, clicks per day (UTC), top referrers, browser/OS/device breakdown.
→ verify: tests seed human + bot clicks and check every field, the bot toggle, and 404 for another user.

### 6. Rate limiting
`express-rate-limit` on login (per IP), link writes (per user), redirects (per IP); limits configurable.
→ verify: tests: exceeding each limit returns 429 (limits lowered in tests).

### 7. Frontend scaffold + login page
`npx @angular/cli@14 new` under Node 16, routing, environment API URL, auth service, JWT interceptor, auth guard, Google sign-in button.
→ verify: `ng build` succeeds; (manual) sign-in lands on `/links`, logged-out user is sent to `/login`.

### 8. Links page
Create form (alias, expiry optional), table of my links with copy, edit, delete (with confirmation), QR (show + download PNG).
→ verify (manual): create, edit, delete a link; QR downloads and scanning it opens the destination.

### 9. Link detail / analytics page
Total, uniques, bot count + include-bots toggle, per-day chart (`chart.js`), referrer, browser, OS and device tables.
→ verify (manual): numbers match clicks made in step 8.

### 10. Deployment + README
Render config (build/start commands, env vars), `vercel.json` SPA rewrite, production API URL, README with local setup, env vars and deploy steps.
→ verify: live frontend logs in, creates a link, live short URL redirects and is counted.

## What the user provides
- **Atlas:** free cluster, DB user, connection string → `backend/.env` locally and Render env var (never committed). Network access must allow `0.0.0.0/0`, because Render's free tier has no fixed IP.
- **Google Cloud:** OAuth Client ID (Web application). Authorized JavaScript origins: `http://localhost:4200` and the Vercel URL (added after first deploy).
- **GitHub:** a repo to push to (Render and Vercel deploy from it). I will not push without asking.
- **Render + Vercel accounts**, connected to that GitHub repo.

## Known limits
- Render free tier sleeps after inactivity: the first redirect after a pause can take ~30–60 s.
- In-memory rate limits reset on restart and only work with one backend instance (fine on Render free tier).
- Hashed IP + User-Agent overcounts (same person, different devices) and undercounts (shared networks) unique visitors.
