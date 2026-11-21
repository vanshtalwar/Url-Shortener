# Shortly — URL shortener with click analytics

Shorten links (random code or custom alias, optional expiry), edit/delete them, get QR codes, and see who clicks: total clicks, unique visitors, clicks per day, referrers, browsers, OS and devices. Bots are detected and kept out of the numbers unless you ask for them.

- **backend/** — Node + Express 5 + TypeScript + MongoDB (Mongoose). Serves the API and the short-link redirects.
- **frontend/** — Angular 14.

See [PLAN.md](PLAN.md) for the design and [context.md](context.md) for current status and build decisions.

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
cp .env.example .env      # then fill in MONGODB_URI, GOOGLE_CLIENT_ID, JWT_SECRET, VISITOR_HASH_SALT
npm install
npm run dev               # http://localhost:3000, check http://localhost:3000/health
```
Generate the two secrets with `openssl rand -hex 32`.

### Frontend (Node 16 via nvm)
```bash
cd frontend
nvm use                   # reads .nvmrc → 16
npm install
```
Put your Google Client ID in `src/environments/environment.ts` (`googleClientId`), then:
```bash
npx ng serve              # http://localhost:4200
```

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

## API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/google` | – | `{credential}` → `{token, user}` |
| POST | `/api/links` | JWT | `{url, alias?, expiresAt?}` → link |
| GET | `/api/links` | JWT | My links (newest first) |
| PATCH | `/api/links/:id` | JWT | Change `url`, `alias`, `expiresAt` (`null` removes expiry) |
| DELETE | `/api/links/:id` | JWT | Delete link and its clicks |
| GET | `/api/links/:id/stats?bots=true` | JWT | Link + analytics |
| GET | `/:code` | – | Redirect (302); 404 unknown, 410 expired |
| GET | `/health` | – | Health check |

Rate limits (429 when exceeded): login 10 per 15 min per IP; create/edit/delete 30 per 15 min per user; redirects 120 per min per IP.

## Known limits
- Render free tier sleeps when idle; the first request after a pause can take 30–60 s.
- Rate limits are in memory: they reset on restart and assume a single backend instance.
- Unique visitors are a salted hash of IP + User-Agent: shared networks undercount, multiple devices overcount.
- The JWT is kept in `localStorage` and lasts 7 days.
