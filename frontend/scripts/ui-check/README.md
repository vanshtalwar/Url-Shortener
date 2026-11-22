# UI check (dev only)

Headless-Chrome checks for the Zelqit frontend. Not part of the app build: it has its own `package.json`
because it needs **Node ≥ 18**, while the app builds on Node 16 (`frontend/.nvmrc`).

## What it checks

`run.mjs` starts a throwaway backend (in-memory MongoDB, seeded with a Pro user, links, clicks and a bio page),
serves a development build of the frontend, and opens every page at 360, 768 and 1280 px:

- horizontal overflow (and the smallest elements causing it),
- console errors and warnings, page errors and failed requests,
- on the landing page, the 3D experience: it loads **after** first contentful paint and draws over the SVG stand-ins;
  live mode has two fixed canvases (3D and particles); with reduced motion there is one still frame in the hero and **no**
  animation frames are requested afterwards; each section, scrolled to the middle of the screen, shows its palette
  and a readable heading (screenshots `<width>-landing-<n>-<section>.png`); the journey reaches every moment
  (screenshots `<width>-journey-<range>-<progress>.png`) and its QR code scans to the site, live and as a still.

The landing checks read `window.xpProgress` / `window.xpTier` and set `localStorage['xp-tier' | 'xp-slow']`, which
only development builds honour (`src/app/experience/landing.ts`); production builds strip them.

Screenshots go to `shots/` (git-ignored).

`contrast.mjs` checks WCAG AA (4.5:1) for every text/background token pair in `src/styles.css`: the light and dark
themes and each landing-section palette (`[data-palette='…']`). Run it after any colour change.

## Setup (once)

```sh
cd backend && npm install && npm run build      # the checker runs backend/dist/server.js
cd ../frontend/scripts/ui-check && npm install   # with Node ≥ 18
```

Google Chrome must be installed. Elsewhere than macOS, set `CHROME_PATH` to its executable.

## Run

From `frontend/`:

```sh
# 1. Development build (Node 16): its API URL is http://localhost:3000, which the checker rewrites to its own backend.
nvm use && npx ng build --configuration development --output-path dist/ui-check

# 2. Checks (Node ≥ 18)
node scripts/ui-check/run.mjs
node scripts/ui-check/contrast.mjs
```

The checker's backend listens on **3100** and the site on **4300**, so a dev backend on 3000 can keep running.
It exits with code 1 when it finds a problem.

| Variable | Effect |
|---|---|
| `ONLY=/,/pricing` | only these paths (`STATS` = the A/B link's stats page); defaults to 360 px |
| `WIDTH=1280` | one width |
| `FULL=1` | full-page screenshots |
| `REDUCED=1` | emulate `prefers-reduced-motion: reduce` |
| `PHONE=1` | emulate an iPhone 13 (390 × 844 at 3×, touch): the landing must start on a lighter 3D tier, drawn at ≤ 1.5 px per CSS px |
| `THROTTLE=6` | slow the CPU 6×: the landing's frame-rate guard must lower the 3D tier |
| `SLOW=60` | burn 60 ms per 3D frame (dev builds): forces the switch to stills, then checks no live canvas or frame is left |
| `FPS=1` | measure the landing's frame rate at each moment on the real GPU (macOS Metal), 2× screen; needs ≥ 55 fps (≥ 45 with `PHONE=1`; add `THROTTLE=4` for a phone-class CPU) |
| `ROUNDS=5` | leave the landing for /pricing and come back 5×: nothing of the 3D may remain away (canvases, WebGL contexts, pins, Lenis, animation frames), one context when back. The JS heap it prints includes V8's compiled code, which grows a little per round as code warms up; for leaks, compare heap snapshots (detached DOM) |
| `XP_TIER=medium` | the 3D tier to pin for the other checks (default `high`; not pinned with `PHONE`/`THROTTLE`/`SLOW`) |
| `WAIT=700` | ms to wait after load before measuring |
| `INTERACT=1` | also test keyboard focus in the links page's modal and drawer |
| `API_PORT`, `WEB_PORT` | change the ports (3100 / 4300) |
| `DIST` | another build folder (default `dist/ui-check`) |

## Lighthouse

Use a production build (`npx ng build`) and the gzip static server:

```sh
node scripts/ui-check/serve.mjs dist/frontend 4300 &
npx lighthouse@12.2.1 http://localhost:4300/ --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo \
  --chrome-flags="--headless=new --enable-unsafe-swiftshader" --output=json --output-path=./scripts/ui-check/shots/lh.json
```
