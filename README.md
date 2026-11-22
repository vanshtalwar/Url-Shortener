# Zelqit — URL shortener with click analytics

Shorten links (random code or custom alias, optional expiry and password), edit/delete them, get QR codes, and see who clicks: total clicks, unique visitors, clicks per day, referrers, browsers, OS and devices. Bots are detected and kept out of the numbers unless you ask for them.

**Plans:** Free (25 new links/month, 30-day analytics history) and Pro (₹199/month or ₹1,990/year via Razorpay): unlimited links, full history, country/city analytics, folders & tags, UTM presets, A/B destination splits and a link-in-bio page. Sign in with Google or email + password.

- **backend/** — Node + Express 5 + TypeScript + MongoDB (Mongoose). Serves the API and the short-link redirects.
- **frontend/** — Angular 14 + Tailwind CSS 3.4, light/dark themes, a three.js 3D hero on the landing page, and lazy-loaded areas (marketing, sign-in, dashboard, stats, public link-in-bio pages).

## 1. One-time setup

### MongoDB Atlas
1. Create a free cluster at https://cloud.mongodb.com.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → add your IP. For Render, also add `0.0.0.0/0` (Render's free tier has no fixed IP).
4. **Connect → Drivers** → copy the connection string. Add a database name before the `?`, e.g. `...mongodb.net/url-shortener?retryWrites=true...`.

### Google sign-in
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → OAuth consent screen** → External, fill in the app name and your email.
3. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
4. **Authorized JavaScript origins**: `http://localhost:4200` (add your Vercel URL later). No redirect URIs are needed.
5. Copy the **Client ID** (not secret).

## 2. Run locally

### Backend (Node 22+)
```bash
cd backend
cp .env.example .env      # then fill in every uncommented key (see "Backend settings" below)
npm install
npm run dev               # http://localhost:3000, check http://localhost:3000/health
```
Generate `JWT_SECRET` and `VISITOR_HASH_SALT` with `openssl rand -hex 32`. The server refuses to start if a required setting is missing.

### Frontend (Node 16 via nvm)
```bash
cd frontend
nvm use                   # reads .nvmrc → 16
npm install
```
Put your Google Client ID in `src/environments/environment.ts` (`googleClientId`), then:
```bash
npx ng serve              # http://localhost:4200
npx ng build              # production build → dist/frontend (must finish with no warnings)
```

Frontend notes:
- **Business details** for the Contact, Terms, Privacy and Refunds pages live in `src/app/marketing/business.ts` as `[PLACEHOLDERS]`. Fill them in before applying for Razorpay live mode. The legal text is a starting template, not legal advice.
- **Guides** are Markdown files in `src/assets/blog/` (listed in `index.json`); edit them directly.
- **Plan prices and the comparison table** come from `src/app/marketing/plans.ts`; keep it in step with `backend/src/plans.ts`.
- **Map data** (`world-atlas`) is copied to `assets/geo/` at build time and only downloaded by Pro users on a stats page.

## 3. Tests
```bash
cd backend
npm test                  # Jest + supertest against an in-memory MongoDB; never touches Atlas
```
The first run downloads a MongoDB binary for the in-memory server.

## 4. Deploy

You need the code in a GitHub repo first. Order matters because each side needs the other's URL.

1. **Backend on Render**: New → **Blueprint** → pick the repo (uses [render.yaml](render.yaml)). When prompted, enter `MONGODB_URI`, `GOOGLE_CLIENT_ID`, and for now any placeholder for `FRONTEND_ORIGIN`. `JWT_SECRET` and `VISITOR_HASH_SALT` are generated. Note the service URL, e.g. `https://url-shortener-api.onrender.com`, and check `/health`.
2. **Frontend config**: in `frontend/src/environments/environment.prod.ts` set `apiUrl` to the Render URL and `googleClientId` to your Client ID. Commit and push.
3. **Frontend on Vercel**: Add New → Project → pick the repo, set **Root Directory** to `frontend`. [vercel.json](frontend/vercel.json) sets the build command, output folder, and the SPA rewrite. Note the Vercel URL.
4. **Connect them**: on Render set `FRONTEND_ORIGIN` to the Vercel URL (no trailing slash). In Google Cloud add the Vercel URL to Authorized JavaScript origins.
5. **Check**: open the Vercel URL, sign in, create a link, open the short link, and confirm the click appears on the Stats page.

The frontend builds on Vercel with its default Node version (tested locally with Node 22 and 24).

## Backend settings
Required (the server won't start without them): `FRONTEND_ORIGIN`, `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `VISITOR_HASH_SALT`, `SMTP_USER`, `SMTP_PASS`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_MONTHLY`, `RAZORPAY_PLAN_YEARLY`. Optional: `PORT`, `TRUST_PROXY_HOPS`, the rate limits, and the MaxMind keys. [backend/.env.example](backend/.env.example) explains each.

- **Email (Gmail SMTP):** turn on 2-Step Verification for the Gmail account, create an app password (Google Account → Security → App passwords), and use it as `SMTP_PASS`. Switch to Resend once you own a domain.
- **Razorpay:** start in Test mode. Create two plans (Subscriptions → Plans: ₹199 every month, ₹1,990 every year) and copy their IDs. Add a webhook to `<backend URL>/api/billing/webhook` with the subscription events, and set its secret as `RAZORPAY_WEBHOOK_SECRET`.
- **Country/city analytics:** create a free MaxMind account and license key, and set `MAXMIND_ACCOUNT_ID` + `MAXMIND_LICENSE_KEY` where the backend is **built** (on Render: Environment). `npm run build` then downloads GeoLite2 City into `backend/data/`. Without them everything works but locations show as "Unknown". GeoLite2 requires the attribution "This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com".

## API
All JSON; errors are `{ error, code? }`. Plan errors are 403 with `code` `PLAN_LIMIT` or `PRO_FEATURE`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/google` | – | `{credential}` → `{token, me}` |
| POST | `/api/auth/register` | – | `{email, password}` → 201, sends verification email |
| POST | `/api/auth/verify-email` | – | `{token}` → `{token, me}` |
| POST | `/api/auth/resend-verification` | – | `{email}` → 204 |
| POST | `/api/auth/login` | – | `{email, password}` → `{token, me}` |
| POST | `/api/auth/forgot-password` | – | `{email}` → 204 (always) |
| POST | `/api/auth/reset-password` | – | `{token, password}` → 204 |
| GET | `/api/me` | JWT | User, plan, limits, usage |
| PATCH | `/api/me/password` | JWT | Set or change password |
| GET / POST | `/api/links` | JWT | List (`?folder&tag&q`) / create |
| PATCH / DELETE | `/api/links/:id` | JWT | Edit any subset of fields / delete with its clicks |
| GET | `/api/links/:id/stats?bots=true` | JWT | Link analytics |
| GET | `/api/stats/overview?days=7\|30\|90` | JWT | Dashboard totals |
| GET / POST, PATCH / DELETE | `/api/folders`, `/api/folders/:id` | JWT | Folders (create/rename: Pro) |
| GET / POST, DELETE | `/api/utm-presets`, `/api/utm-presets/:id` | JWT | UTM presets (create: Pro) |
| GET / PUT / DELETE | `/api/bio` | JWT | Your link-in-bio page (publish/edit: Pro) |
| GET | `/api/public/bio/:handle` | – | Public link-in-bio data |
| GET | `/api/billing` | JWT | Plan + subscription |
| POST | `/api/billing/subscribe` / `verify` / `cancel` | JWT | Razorpay subscription flow |
| POST | `/api/billing/webhook` | Razorpay signature | Subscription status updates |
| GET | `/:code` | – | Redirect (302); 404 unknown, 410 expired; password page if protected |
| POST | `/:code/unlock` | – | Password form → 302 or 401 |
| GET | `/health` | – | Health check |

Rate limits (429 when exceeded): login/sign-up/reset 10 per 15 min per IP; link, folder, preset and bio writes 30 per 15 min per user; redirects 120 per min per IP; password guesses 10 per 15 min per IP per link. Override with `LOGIN_RATE_LIMIT`, `LINK_WRITE_RATE_LIMIT`, `REDIRECT_RATE_LIMIT`, `UNLOCK_RATE_LIMIT`.

## Client IP behind proxies
Unique visitors and per-IP rate limits depend on the app seeing the real client IP. `TRUST_PROXY_HOPS` (default `1`) is the number of reverse proxies in front of the app. To check it on Render: open one short link in the same browser once on Wi-Fi and once on a phone hotspot. If **Unique visitors** goes up by 2, the value is right; if only by 1, increase `TRUST_PROXY_HOPS` by one and redeploy. Too high a value lets clients fake their IP via `X-Forwarded-For`, so don't go higher than needed.

## Known limits
- Render free tier sleeps when idle; the first request after a pause can take 30–60 s.
- Rate limits are in memory: they reset on restart and assume a single backend instance.
- Unique visitors are a salted hash of IP + User-Agent: shared networks undercount, multiple devices overcount.
- The JWT is kept in `localStorage` and lasts 7 days.
- The frontend is a single-page app without server-side rendering, so search engines see less of the marketing pages and guides than they would with SSR.
- Lighthouse (mobile, local build with gzip): accessibility 100, best practices 100, SEO 100, performance 68–81. The limits are the JavaScript needed before first paint and the 3D hero (started only when the browser is idle). Measure again on the deployed site.
