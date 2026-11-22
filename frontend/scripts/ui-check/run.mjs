// Renders every Zelqit page in headless Chrome at 3 widths against a throwaway, seeded backend, and reports
// horizontal overflow, console/page errors and failed requests. Screenshots go to ./shots. See README.md.
import { createRequire } from 'node:module';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import puppeteer, { KnownDevices } from 'puppeteer-core';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '../..');
const backendDir = resolve(frontendDir, '../backend');
const distDir = resolve(process.env.DIST ?? join(frontendDir, 'dist/ui-check'));
const shotsDir = join(here, 'shots');
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Not 3000, so a dev backend you're running keeps its port; the dev build's API URL is rewritten to this one below.
const API_PORT = Number(process.env.API_PORT ?? 3100);
const WEB_PORT = Number(process.env.WEB_PORT ?? 4300);

const breq = createRequire(join(backendDir, 'package.json'));
const { MongoMemoryServer } = breq('mongodb-memory-server');
const mongoose = breq('mongoose');
const jwt = breq('jsonwebtoken');

const portFree = (port) => new Promise((ok) => {
  const probe = createNetServer().once('error', () => ok(false)).once('listening', () => probe.close(() => ok(true))).listen(port);
});
for (const port of [API_PORT, WEB_PORT]) {
  if (!(await portFree(port))) {
    console.error(`Port ${port} is in use. Stop whatever is using it or set API_PORT / WEB_PORT.`);
    process.exit(1);
  }
}
await stat(join(distDir, 'index.html')).catch(() => {
  console.error(`No build at ${distDir}. Build first: npx ng build --configuration development --output-path dist/ui-check`);
  process.exit(1);
});
await mkdir(shotsDir, { recursive: true });

// --- backend with a throwaway in-memory database ---------------------------------------------------
const mongo = await MongoMemoryServer.create();
const env = { ...process.env, MONGODB_URI: mongo.getUri() + 'zelqit', PORT: String(API_PORT), JWT_SECRET: 'ui-check', GOOGLE_CLIENT_ID: 'x.apps.googleusercontent.com',
  VISITOR_HASH_SALT: 's', FRONTEND_ORIGIN: `http://localhost:${WEB_PORT}`, SMTP_USER: 'u@example.com', SMTP_PASS: 'p', RAZORPAY_KEY_ID: 'rzp_test_x',
  RAZORPAY_KEY_SECRET: 'k', RAZORPAY_WEBHOOK_SECRET: 'w', RAZORPAY_PLAN_MONTHLY: 'pm', RAZORPAY_PLAN_YEARLY: 'py', GEOIP_DB_PATH: '/nonexistent' };
const api = spawn(process.execPath, ['dist/server.js'], { cwd: backendDir, env });
process.on('exit', () => api.kill('SIGKILL')); // never leave it running, even if this script crashes
let apiLog = ''; api.stdout.on('data', (d) => (apiLog += d)); api.stderr.on('data', (d) => (apiLog += d));
await new Promise((r) => setTimeout(r, 2500));

// --- seed: a verified Pro user with links, folders, clicks and a bio page ----------------------------
await mongoose.connect(mongo.getUri() + 'zelqit');
const db = mongoose.connection.db;
const owner = (await db.collection('users').insertOne({ email: 'priya.sharma@example.com', emailVerified: true, googleId: 'g1', passwordHash: null,
  subscription: { id: 'sub_x', status: 'active', interval: 'yearly', currentPeriodEnd: new Date(Date.now() + 200 * 864e5), cancelAtPeriodEnd: false, lastEventAt: null },
  createdAt: new Date(), updatedAt: new Date() })).insertedId;
const folder = (await db.collection('folders').insertOne({ owner, name: 'Spring campaign', createdAt: new Date(), updatedAt: new Date() })).insertedId;
const mk = (code, url, extra = {}) => ({ owner, code, url, expiresAt: null, folderId: null, tags: [], passwordHash: null, variants: [], createdAt: new Date(), updatedAt: new Date(), ...extra });
const links = [
  mk('spring-sale', 'https://shop.example.com/collections/spring-sale-2026?utm_source=instagram&utm_medium=social&utm_campaign=spring_sale', { folderId: folder, tags: ['sale', 'instagram', 'q2-launch'] }),
  mk('newsletter-march-edition-long-alias', 'https://blog.example.com/a/really/long/path/that/keeps/going/and/going/for/testing/overflow?ref=newsletter', { tags: ['email'] }),
  mk('vault', 'https://docs.example.com/private', { passwordHash: '$2a$10$abcdefghijklmnopqrstuuJ1jW8eWm3bWJ0zM4Qk5mWw2o0bqk3Ga' }),
  mk('ab-hero', 'https://example.com/a', { variants: [{ url: 'https://example.com/landing-a', weight: 60 }, { url: 'https://example.com/landing-b', weight: 40 }] }),
  mk('old-promo', 'https://example.com/old', { expiresAt: new Date(Date.now() - 864e5) }),
  mk('Ab3xK9q', 'https://example.com/random-code'),
];
const ids = (await db.collection('links').insertMany(links)).insertedIds;
const countries = [['IN', 'Mumbai'], ['IN', 'Delhi'], ['IN', 'Bengaluru'], ['US', 'New York'], ['GB', 'London'], ['DE', 'Berlin'], ['BR', 'São Paulo'], ['Unknown', 'Unknown']];
const browsers = ['Chrome', 'Mobile Safari', 'Firefox', 'Edge']; const oses = ['Android', 'iOS', 'Windows', 'macOS']; const devices = ['mobile', 'desktop', 'tablet'];
const refs = ['instagram.com', '', 'news.ycombinator.com', 't.co', 'mail.google.com'];
const clicks = [];
for (let i = 0; i < 420; i++) {
  const [country, city] = countries[i % countries.length];
  clicks.push({ link: ids[i % 4], clickedAt: new Date(Date.now() - (i % 29) * 864e5 - (i % 7) * 36e5), referrer: refs[i % refs.length], browser: browsers[i % 4],
    os: oses[(i >> 1) % 4], deviceType: devices[i % 3], isBot: i % 23 === 0, visitorHash: 'v' + (i % 150), variantUrl: ids[i % 4] === ids[3] ? (i % 5 < 3 ? 'https://example.com/landing-a' : 'https://example.com/landing-b') : null,
    country, city });
}
await db.collection('clicks').insertMany(clicks);
await db.collection('bios').insertOne({ owner, handle: 'priya', title: 'Priya Sharma', description: 'Designer & maker. Shop, newsletter and latest projects.', theme: 'violet',
  links: [{ linkId: ids[0], label: 'Spring sale — 30% off' }, { linkId: ids[1], label: 'Read the newsletter' }, { linkId: ids[3], label: 'New landing page' }], createdAt: new Date(), updatedAt: new Date() });
// …and a new Free account with nothing yet: the dashboard's empty states.
const newcomer = (await db.collection('users').insertOne({ email: 'sam.lee@example.com', emailVerified: true, googleId: 'g2', passwordHash: null, subscription: null,
  createdAt: new Date(), updatedAt: new Date() })).insertedId;
const session = (id, email) => ({ token: jwt.sign({ sub: id.toString() }, 'ui-check', { expiresIn: '1h' }), user: JSON.stringify({ id: id.toString(), email }) });
const sessions = { pro: session(owner, 'priya.sharma@example.com'), new: session(newcomer, 'sam.lee@example.com') };
const { token, user } = sessions.pro;

// --- static server for the build (SPA fallback), pointing its API URL at the throwaway backend -------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/markdown', '.map': 'application/json' };
const web = createHttpServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(distDir, path);
  try { if (!(await stat(file)).isFile()) throw 0; } catch { file = join(distDir, 'index.html'); }
  let body = await readFile(file);
  if (extname(file) === '.js') body = body.toString().replaceAll('http://localhost:3000', `http://localhost:${API_PORT}`);
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
}).listen(WEB_PORT);

// --- render every page at 3 widths -----------------------------------------------------------------
const guestPages = ['/', '/features', '/pricing', '/about', '/contact', '/blog', '/blog/utm-parameters-explained', '/legal/privacy', '/login', '/signup', '/forgot-password', '/@priya', '/@nobody'];
const appPages = ['/app', '/app/links', `/app/links/${ids[3]}`, `/app/links/${ids[5]}`, '/app/bio', '/app/billing', '/app/settings'];
const newcomerPages = ['/app', '/app/links', '/app/bio']; // the new account's empty states
// ONLY=paths (STATS = the A/B link's stats page), WIDTH=one width, FULL=1 full-page shots, REDUCED=1 reduced motion.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((p) => (p === 'STATS' ? `/app/links/${ids[3]}` : p === 'NOCLICKS' ? `/app/links/${ids[5]}` : p)) : null;
const REDUCED = Boolean(process.env.REDUCED);
const PHONE = Boolean(process.env.PHONE); // emulate an iPhone 13 (390 × 844 at 3×, touch)
const THROTTLE = Number(process.env.THROTTLE ?? 0); // slow the CPU this many times
const SLOW = Number(process.env.SLOW ?? 0); // dev builds: burn this many ms per 3D frame (headless frames are hard to slow)
const FPS = Boolean(process.env.FPS); // sample the 3D pages' frame rates per moment, on the real GPU (macOS Metal)
const ROUNDS = Number(process.env.ROUNDS ?? 0); // leave each 3D page and come back this many times
// The 3D tier is pinned to keep checks deterministic, except when the tier choice itself is under test.
const PIN_TIER = FPS ? (PHONE ? 'medium' : 'high') : PHONE || THROTTLE || SLOW ? '' : process.env.XP_TIER ?? 'high';
const widths = PHONE ? [{ w: 390, h: 844 }] : process.env.WIDTH ? [{ w: Number(process.env.WIDTH), h: 800 }] : ONLY ? [{ w: 360, h: 780 }] : [{ w: 360, h: 780 }, { w: 768, h: 1024 }, { w: 1280, h: 800 }];
if (!widths.every(({ w }) => Number.isInteger(w) && w > 0)) throw new Error(`WIDTH must be a number of pixels, got "${process.env.WIDTH}"`);
// Expected here, not bugs: Google Sign-In rejects the checker's origin (only real origins are registered for the
// client ID), and /@nobody is a deliberate 404.
// The 3D marketing pages: the whole journey (landing, features) or the link settling above the Pro card (pricing).
const XP_PAGES = { '/': 'journey', '/features': 'journey', '/pricing': 'pricing' };
const slug = (path) => path.replace(/[^a-z0-9]+/gi, '') || 'landing';
// The dashboard's 3D illustrations (<z-scene>) on each page, by account (Phase 3). Checked in the default, REDUCED and
// SLOW modes; the other modes are about the marketing pages' 3D.
const SCENES = {
  pro: { '/app': ['pulse'], [`/app/links/${ids[3]}`]: ['globe'], [`/app/links/${ids[5]}`]: ['qr'] },
  new: { '/app': ['chain'], '/app/links': ['chain'], '/app/bio': ['stack'] },
};
const CHECK_DASHBOARD = !(PHONE || THROTTLE || FPS || ROUNDS);
const expected = (path, message) => message.includes('[GSI_LOGGER]: The given origin is not allowed') || (path === '/@nobody' && message.includes('status of 404'));
// Software WebGL (SwiftShader) for repeatable checks; the real GPU (Metal, macOS) to measure frame rates.
const GPU = FPS || Boolean(process.env.GPU); // the real GPU (macOS Metal) rather than the software one
const gpuArgs = GPU ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: [...gpuArgs, '--no-first-run', '--js-flags=--expose-gc'] });
const results = [];
for (const { w, h } of widths) {
  const all = [...guestPages.map((p) => [p, null]), ...appPages.map((p) => [p, 'pro']), ...newcomerPages.map((p) => [p, 'new'])];
  for (const [path, account] of all.filter(([p]) => !ONLY || ONLY.includes(p))) {
    const page = await browser.newPage();
    if (PHONE) await page.emulate(KnownDevices['iPhone 13']);
    else await page.setViewport({ width: w, height: h, deviceScaleFactor: FPS ? 2 : 1 }); // frame rates on a retina-class screen
    if (THROTTLE) await page.emulateCPUThrottling(THROTTLE);
    if (REDUCED) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument((t, u, tier, slow) => {
      // Once per tab: a reload keeps what the page saved (the particles switch).
      if (!sessionStorage.getItem('ui-check')) {
        sessionStorage.setItem('ui-check', '1');
        localStorage.clear();
        if (t) { localStorage.setItem('token', t); localStorage.setItem('user', u); }
        // Dev builds: pin the 3D quality tier so a slow software GPU can't swap the live journey for stills mid-check.
        if (tier) localStorage.setItem('xp-tier', tier);
        if (slow) localStorage.setItem('xp-slow', String(slow));
      }
      // Long tasks (the main thread busy > 50 ms), to check the dashboard stays responsive while idle.
      window.__longTasks = [];
      new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longTasks.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); })
        .observe({ type: 'longtask', buffered: true });
      // Count live WebGL contexts (created minus lost), to prove leaving a 3D page frees its context.
      window.__glLive = 0;
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const fresh = !this.__gl;
        const context = getContext.call(this, type, ...rest);
        if (context && fresh && /webgl/.test(type)) {
          this.__gl = true;
          window.__glLive++;
          this.addEventListener('webglcontextlost', () => window.__glLive--);
        }
        return context;
      };
      // Count animation frames requested, to prove still pages stop asking for them.
      const raf = window.requestAnimationFrame.bind(window);
      window.__frames = 0;
      window.requestAnimationFrame = (cb) => { window.__frames++; return raf(cb); };
    }, sessions[account]?.token, sessions[account]?.user, PIN_TIER, SLOW);
    const errors = [];
    // Warnings too (ours and libraries'), except headless Chrome's software-GL driver notes ("GPU stall due to ReadPixels").
    page.on('console', (m) => {
      if ((m.type() === 'error' || m.type() === 'warn') && !m.text().includes('GL Driver Message') && !expected(path, m.text())) errors.push(`${m.type().toUpperCase()} ${m.text().slice(0, 160)}`);
    });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)));
    page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g') && !r.url().includes('accounts.google')) errors.push('REQFAIL ' + r.url().slice(0, 100)); });
    await page.goto(`http://localhost:${WEB_PORT}${path}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch((e) => errors.push('NAV ' + e.message));
    const kind = XP_PAGES[path];
    const xp = kind ? await checkExperience(page) : null;
    if (xp && !xp.problem) {
      if (ROUNDS) xp.rounds = await checkRoundTrips(page, ROUNDS, path);
      else if (FPS) xp.frameRate = await checkFrameRate(page, PHONE ? 45 : 55, kind);
      else if (THROTTLE || SLOW) xp.downgrade = await checkDowngrade(page);
      else if (PHONE) xp.phone = await checkPhone(page);
      else {
        if (path === '/' && w >= 1024) xp.cursor = await checkCursor(page, w); // a mouse: desktop widths
        xp.sections = await checkSections(page, w, path);
        if (kind === 'journey') xp.journey = await checkJourney(page, w, path);
        else xp.drop = await checkDrop(page, w);
      }
    }
    const dash = account && CHECK_DASHBOARD ? await checkDashboard(page, SCENES[account][path] ?? [], w, path, account) : null;
    await new Promise((r) => setTimeout(r, Number(process.env.WAIT ?? 700)));
    const metrics = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) continue;
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const s = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) { clipped = true; break; } p = p.parentElement; }
        if (clipped || getComputedStyle(el).position === 'fixed') continue;
        over.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} right=${Math.round(r.right)}`);
      }
      // The smallest elements sticking out are usually the real cause (their ancestors just contain them).
      const smallest = [...document.querySelectorAll('body *')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.right > vw + 1 && r.width > 0)
        .sort((a, b) => a.r.width - b.r.width)
        .slice(0, 5)
        .map(({ el, r }) => `${el.tagName.toLowerCase()}[${String(el.className).slice(0, 60)}] w=${Math.round(r.width)} right=${Math.round(r.right)} "${(el.textContent || '').trim().slice(0, 40)}"`);
      return { smallest, scrollW: document.documentElement.scrollWidth, vw, title: document.title, overflowing: over.slice(0, 4), h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? null };
    });
    if (xp?.problem) errors.push('3D ' + xp.problem);
    if (dash?.problem) errors.push('DASHBOARD ' + dash.problem);
    for (const part of ['cursor', 'sections', 'journey', 'drop', 'downgrade', 'phone', 'frameRate', 'rounds']) {
      if (xp?.[part]?.problem) errors.push(`3D ${part.toUpperCase()} ${xp[part].problem}`);
    }
    const name = `${w}-${(path.replace(/[^a-z0-9@]+/gi, '_') || 'root').replace(/^_|_$/g, '') || 'home'}${account === 'new' ? '-new' : ''}${REDUCED ? '-reduced' : ''}.png`;
    await page.screenshot({ path: join(shotsDir, (process.env.FULL ? 'full-' : '') + name), fullPage: Boolean(process.env.FULL) });
    results.push({ w, path, account, horizontalScroll: metrics.scrollW > metrics.vw, ...metrics, errors, xp, dash });
    await page.close();
  }
}

/**
 * A 3D page: the experience chunk loads after first paint and draws over the SVG stand-ins. Live: two fixed canvases
 * (3D + particles). Reduced motion: a still frame in every anchor, and no animation frames once they're drawn.
 */
async function checkExperience(page) {
  const drawn = await settle(page.waitForFunction(() => Boolean(document.querySelector('[data-xp-anchor][data-xp-drawn]')), { timeout: 15000 })).then(() => true, () => false);
  if (!drawn) return { problem: 'the 3D was never drawn over its SVG stand-ins' };
  const framesBefore = await page.evaluate(() => window.__frames);
  await new Promise((r) => setTimeout(r, 1000));
  // With THROTTLE/SLOW the page may already have switched to stills: checkDowngrade checks that end state.
  return page.evaluate((reduced, framesBefore, downgrading) => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? Infinity;
    const chunk = performance.getEntriesByType('resource').find((e) => /experience/.test(e.name));
    const live = [...document.querySelectorAll('canvas')].filter((c) => getComputedStyle(c).position === 'fixed');
    const anchors = document.querySelectorAll('[data-xp-anchor]').length;
    const still = document.querySelectorAll('[data-xp-anchor] > canvas');
    const framesPerSecond = window.__frames - framesBefore;
    const facts = { chunkStartMs: Math.round(chunk?.startTime ?? -1), fcpMs: Math.round(fcp), liveCanvases: live.length, stillCanvases: still.length, framesPerSecond };
    const problem = !chunk ? 'experience chunk not loaded'
      : chunk.startTime < fcp ? 'experience chunk requested before first contentful paint'
      : reduced && (live.length || still.length !== anchors) ? `reduced motion should draw a still in each of the ${anchors} anchors, and no live canvas`
      : reduced && framesPerSecond > 0 ? `reduced motion still requests animation frames (${framesPerSecond}/s)`
      : !reduced && !downgrading && (live.length !== 2 || still.length) ? 'expected two live canvases (3D + particles)'
      : null;
    return { ...facts, problem };
  }, REDUCED, framesBefore, Boolean(THROTTLE || SLOW));
}

/**
 * Scrolls each section of a 3D page to the middle of the screen, waits for the palette cross-fade and headline reveal,
 * takes a screenshot, and checks that the page shows that section's palette (live: the whole page via <html>;
 * still: the section itself, with the header following) and that its heading is readable on what's behind it.
 */
async function checkSections(page, width, path) {
  const count = await page.evaluate(() => document.querySelectorAll('main section').length);
  const report = [];
  for (let i = 0; i < count; i++) {
    await page.evaluate((i) => {
      const box = document.querySelectorAll('main section')[i].getBoundingClientRect();
      window.scrollTo(0, window.scrollY + box.top + Math.min(box.height, innerHeight) / 2 - innerHeight / 2);
    }, i);
    await new Promise((r) => setTimeout(r, 1600));
    const facts = await page.evaluate((i) => {
      const section = document.querySelectorAll('main section')[i];
      const own = section.dataset.palette ?? section.dataset.xpPalette ?? null;
      const rgb = (css) => css.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = (c) => { const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
      // What's actually behind the heading: the first of section, body, html that paints a background.
      const clear = (css) => /rgba\(.*, 0\)|transparent/.test(css);
      const behind = [section, document.body, document.documentElement].map((el) => getComputedStyle(el).backgroundColor).find((bg) => !clear(bg));
      const heading = section.querySelector('h1, h2');
      const contrast = heading && !section.classList.contains('bg-cta') ? ratio(rgb(getComputedStyle(heading).color), rgb(behind)) : null;
      let expectedBg = null;
      if (own) {
        const probe = document.createElement('div');
        probe.dataset.palette = own;
        document.body.appendChild(probe);
        expectedBg = getComputedStyle(probe).backgroundColor;
        probe.remove();
      }
      return { section: section.getAttribute('aria-labelledby'), own, page: document.documentElement.dataset.palette ?? null, behind, expectedBg, contrast };
    }, i);
    const problem = facts.own && facts.page !== facts.own ? `page palette ${facts.page}, expected ${facts.own}`
      : facts.own && facts.behind !== facts.expectedBg ? `background ${facts.behind}, expected ${facts.expectedBg}`
      : facts.contrast !== null && facts.contrast < 3 ? `heading contrast ${facts.contrast.toFixed(2)}`
      : null;
    if (problem) report.problem = (report.problem ? report.problem + '; ' : '') + `${facts.section}: ${problem}`;
    report.push(`${facts.section}=${facts.own ?? '-'}${facts.contrast ? ` ${facts.contrast.toFixed(1)}:1` : ''}`);
    await page.screenshot({ path: join(shotsDir, `${width}-${slug(path)}-${i + 1}-${facts.section}${REDUCED ? '-reduced' : ''}.png`) });
  }
  return report;
}

/**
 * Waits on a puppeteer wait, then releases the handle it returns: an undisposed element handle keeps that element —
 * and its whole detached page — alive in the browser, which would look like a memory leak in ROUNDS.
 */
async function settle(waiting) {
  const handle = await waiting;
  await handle?.dispose();
}

/** The QR code in a PNG screenshot, decoded (null if none). */
function decodeQr(buffer) {
  const png = PNG.sync.read(Buffer.from(buffer)); // puppeteer returns a Uint8Array
  return jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height)?.data ?? null;
}

/** Screenshot of an element's box plus a margin (a phone framing it), as a PNG buffer. Doesn't scroll. */
async function shootBox(page, selector, margin = 24) {
  // Puppeteer's clip is in document coordinates; keep it inside the viewport: what's on screen now.
  const clip = await page.evaluate((selector, margin) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    const left = Math.max(0, r.left - margin), top = Math.max(0, r.top - margin);
    return { x: left + scrollX, y: top + scrollY, width: Math.min(innerWidth, r.right + margin) - left, height: Math.min(innerHeight, r.bottom + margin) - top };
  }, selector, margin);
  return page.screenshot({ clip, captureBeyondViewport: false }); // the default scrolls the page to capture
}

/**
 * A dashboard page (Phase 3): its 3D illustrations (<z-scene>) draw over their fallbacks after first paint — except
 * the globe with reduced motion, which keeps the 2D map — and really paint something (screenshots
 * `<width>-<page>-<account>-<kind>.png`); the no-clicks QR code scans to the link; the background particles run behind
 * the app, except with reduced motion, when nothing requests animation frames. SLOW: the frame-rate guards must end
 * the same way (stills, the globe back to the map, no particles, no frames). Overview: no long tasks while idle.
 * Settings: the particles switch. New account's Overview: WebGL contexts freed on navigation.
 */
async function checkDashboard(page, kinds, width, path, account) {
  const still = REDUCED || SLOW;
  const drawnExpected = still ? kinds.filter((k) => k !== 'globe').length : kinds.length;
  await settle(page.waitForFunction((n, particles) => document.querySelectorAll('z-scene[data-xp-drawn]').length >= n && (!particles || document.querySelector('app-app-layout > canvas')),
    { timeout: 15000 }, drawnExpected, !still)).catch(() => undefined);
  if (SLOW) {
    // On screen (scenes only animate there), until the guards give up animating (2 s windows), at most 20 s.
    await page.evaluate(() => document.querySelector('z-scene')?.scrollIntoView({ block: 'center' }));
    for (let i = 0, last = -1; i < 20; i++) {
      const frames = await page.evaluate(() => window.__frames);
      if (frames === last) break;
      last = frames;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const framesBefore = await page.evaluate(() => window.__frames);
  await new Promise((r) => setTimeout(r, 1000));
  const facts = await page.evaluate((framesBefore) => {
    const scenes = [...document.querySelectorAll('z-scene')];
    return {
      scenes: scenes.length,
      drawn: scenes.filter((s) => 'xpDrawn' in s.dataset && s.querySelector(':scope > canvas')).length,
      particles: document.querySelectorAll('app-app-layout > canvas').length,
      framesPerSecond: window.__frames - framesBefore,
    };
  }, framesBefore);
  let problem = facts.scenes !== kinds.length ? `expected ${kinds.length} 3D illustrations (${kinds.join(', ') || 'none'}), found ${facts.scenes}`
    : facts.drawn !== drawnExpected ? `${facts.drawn} of ${drawnExpected} 3D illustrations drawn`
    : still && facts.particles ? `background particles despite ${REDUCED ? 'reduced motion' : 'slow frames'}`
    : !still && facts.particles !== 1 ? `${facts.particles} background particle canvases, expected 1`
    : still && facts.framesPerSecond > 0 ? `still requests animation frames (${facts.framesPerSecond}/s)`
    : null;
  if (problem) return { ...facts, problem };

  // What's painted in each scene's box (share of pixels unlike its background); the QR code must scan.
  facts.painted = {};
  for (const [i, kind] of kinds.entries()) {
    const drawn = await page.evaluate((i) => {
      const scene = document.querySelectorAll('z-scene')[i];
      scene.dataset.check = String(i);
      scene.scrollIntoView({ block: 'center' });
      return 'xpDrawn' in scene.dataset;
    }, i);
    if (!drawn) continue; // the globe with reduced motion: the map
    await new Promise((r) => setTimeout(r, 400));
    const shot = await shootBox(page, `z-scene[data-check="${i}"]`, 0);
    await writeFile(join(shotsDir, `${width}-${slug(path)}-${account}-${kind}${REDUCED ? '-reduced' : SLOW ? '-slow' : ''}.png`), shot);
    facts.painted[kind] = Number(coverage(shot).toFixed(3));
    if (facts.painted[kind] < 0.03) problem = `the ${kind} illustration looks blank (${facts.painted[kind]})`;
    if (kind === 'qr') {
      const expected = `http://localhost:${API_PORT}/Ab3xK9q`;
      for (let attempt = 0; attempt < 5 && facts.qr !== expected; attempt++) {
        facts.qr = decodeQr(await shootBox(page, `z-scene[data-check="${i}"]`, 24));
        if (facts.qr !== expected) await new Promise((r) => setTimeout(r, 400));
      }
      if (facts.qr !== expected) problem = `the QR code reads ${JSON.stringify(facts.qr)}, expected ${expected}`;
    }
  }
  if (problem) return { ...facts, problem };
  if (path === '/app' && account === 'pro') facts.idle = await checkIdle(page);
  if (path === '/app' && account === 'new') facts.rounds = await checkSceneRounds(page);
  if (path === '/app/settings' && !SLOW) facts.particlesSwitch = await checkParticlesSwitch(page);
  return { ...facts, problem: facts.idle?.problem ?? facts.rounds?.problem ?? facts.particlesSwitch?.problem ?? null };
}

/**
 * New account: Overview → Links → Overview, 3 times, through the sidebar. Each page's scene must free its WebGL
 * context when the page goes (browsers cap live contexts at ~16): one context, one scene canvas and one particle
 * canvas at the end.
 */
async function checkSceneRounds(page) {
  const go = async (label, path) => {
    await page.evaluate((label) => {
      document.querySelectorAll('z-scene').forEach((scene) => (scene.dataset.old = ''));
      [...document.querySelectorAll('nav a')].find((a) => a.textContent.trim() === label).click();
    }, label);
    await settle(page.waitForFunction((path) => location.pathname === path && document.querySelector('z-scene[data-xp-drawn]:not([data-old])'), { timeout: 15000 }, path));
  };
  for (let i = 0; i < 3; i++) {
    await go('Links', '/app/links');
    await go('Overview', '/app');
  }
  await new Promise((r) => setTimeout(r, 500)); // context-lost events
  const facts = await page.evaluate(() => ({ contexts: window.__glLive, sceneCanvases: document.querySelectorAll('z-scene canvas').length, particles: document.querySelectorAll('app-app-layout > canvas').length }));
  const particles = REDUCED || SLOW ? 0 : 1;
  return { ...facts, problem: facts.contexts !== 1 || facts.sceneCanvases !== 1 || facts.particles !== particles ? `after 3 rounds Overview ↔ Links: ${JSON.stringify(facts)}` : null };
}

/** Overview, settled (3D drawn, particles running): 5 s without input must bring no long tasks. */
async function checkIdle(page) {
  const from = await page.evaluate(() => performance.now());
  await new Promise((r) => setTimeout(r, 5000));
  const { idle, before } = await page.evaluate((from) => ({ idle: window.__longTasks.filter((t) => t.at >= from), before: window.__longTasks.filter((t) => t.at < from) }), from);
  return { longTasks: idle.map((t) => t.ms), startUp: before.map((t) => t.ms), problem: idle.length ? `long tasks while idle on Overview: ${idle.map((t) => `${t.ms} ms`).join(', ')}` : null };
}

/**
 * Settings → Appearance → Background particles: on by default; off stops them and is saved; still off after a
 * reload; on again restarts them. With reduced motion: off, disabled, and no particles.
 */
async function checkParticlesSwitch(page) {
  const find = "[...document.querySelectorAll('button[role=switch]')].find((b) => b.textContent.includes('Background particles'))";
  const read = () => page.evaluate(`(() => {
    const b = ${find};
    return { checked: b?.getAttribute('aria-checked'), disabled: b?.disabled, saved: localStorage.getItem('zelqit-particles'), particles: document.querySelectorAll('app-app-layout > canvas').length };
  })()`);
  const steps = { start: await read() };
  if (REDUCED) {
    const s = steps.start;
    return { ...steps, problem: s.checked !== 'false' || !s.disabled || s.particles ? `with reduced motion the switch should be off and disabled, with no particles: ${JSON.stringify(s)}` : null };
  }
  await page.evaluate(`${find}.click()`);
  await new Promise((r) => setTimeout(r, 300));
  steps.off = await read();
  await page.reload({ waitUntil: 'networkidle0' });
  await settle(page.waitForFunction(find, { timeout: 15000 }));
  await new Promise((r) => setTimeout(r, 2000)); // particles would have started by now
  steps.reloaded = await read();
  await page.evaluate(`${find}.click()`);
  await settle(page.waitForFunction(() => document.querySelector('app-app-layout > canvas'), { timeout: 10000 })).catch(() => undefined);
  steps.on = await read();
  const { start, off, reloaded, on } = steps;
  const problem = start.checked !== 'true' || start.particles !== 1 ? `particles should be on at first: ${JSON.stringify(start)}`
    : off.checked !== 'false' || off.particles || off.saved !== 'off' ? `switching off should stop the particles and save "off": ${JSON.stringify(off)}`
    : reloaded.checked !== 'false' || reloaded.particles ? `the switch should stay off after a reload: ${JSON.stringify(reloaded)}`
    : on.checked !== 'true' || on.particles !== 1 || on.saved !== null ? `switching on should restart the particles and clear "off": ${JSON.stringify(on)}`
    : null;
  return { ...steps, problem };
}

/**
 * Landing with a mouse: the cursor is a dot in a jiggly ring (the system cursor hidden, but the text cursor in the URL
 * field, where the ring steps aside; the ring grows over a button) and the hero link turns to face the mouse (dev-only
 * window.xpFollow, −1…1). Reduced motion: the system cursor and no ring. Screenshots `<width>-cursor-<what>.png`.
 * Ends with the mouse "out of the window", so later checks see the page without it.
 */
async function checkCursor(page, width) {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  // What's on screen around a point (puppeteer's clip is in document coordinates, and mustn't scroll the page).
  const shootAround = async (name, x, y, w, h) => {
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.screenshot({ path: join(shotsDir, `${width}-cursor-${name}.png`), clip: { x: x - w / 2, y: y - h / 2 + scrollY, width: w, height: h }, captureBeyondViewport: false });
  };
  const centre = (selector) => page.evaluate((selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  const read = () => page.evaluate(() => {
    const ring = document.querySelector('.xp-cursor-ring');
    const style = ring && getComputedStyle(ring);
    return {
      ring: Boolean(ring),
      on: document.documentElement.classList.contains('xp-cursor'), // the ring fades to this (0.2 s)
      opacity: style ? Number(style.opacity) : null,
      scale: style ? Number(new DOMMatrix(style.transform).a.toFixed(2)) : null, // at rest it isn't turned
      page: getComputedStyle(document.body).cursor,
      field: getComputedStyle(document.querySelector('#demo-url')).cursor,
      follow: window.xpFollow ? Number(window.xpFollow.x.toFixed(2)) : null,
    };
  });
  const hero = await centre('[data-xp-anchor="hero"]');
  await page.mouse.move(hero.x - 60, hero.y - 40);
  await page.mouse.move(hero.x, hero.y, { steps: 8 });
  await pause(800);
  const steps = { page: await read() };
  if (REDUCED) {
    const s = steps.page;
    return { ...steps, problem: s.ring || s.page !== 'auto' ? `reduced motion should keep the system cursor: ${JSON.stringify(s)}` : null };
  }
  const field = await centre('#demo-url');
  await page.mouse.move(field.x, field.y, { steps: 6 });
  await pause(400);
  steps.field = await read();
  const button = await centre('form[aria-label="Try Zelqit"] button');
  await page.mouse.move(button.x, button.y, { steps: 6 });
  await pause(900);
  steps.button = await read();
  await shootAround('button', button.x, button.y, 240, 120);
  for (const [side, x] of [['left', 4], ['right', width - 4]]) {
    await page.mouse.move(x, hero.y, { steps: 10 });
    await pause(1500);
    steps[side] = await read();
    await page.screenshot({ path: join(shotsDir, `${width}-cursor-hero-${side}.png`) });
  }
  // On a cream section too: the ring's rim takes the section's accent.
  await page.evaluate(() => document.querySelector('[data-xp-section="share"] h2').scrollIntoView({ block: 'center' }));
  await pause(1600); // the palette cross-fade
  await page.mouse.move(width * 0.5, 300, { steps: 6 });
  await pause(800);
  await shootAround('cream', width * 0.5, 300, 200, 200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(600);
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null })));
  await pause(300);
  steps.out = await read();
  const { page: p, field: f, button: b, left, right, out } = steps;
  // Opacities with a margin: the ring fades in and out over 0.2 s.
  const problem = !p.ring || p.opacity < 0.95 || p.page !== 'none' ? `the dot-in-a-ring cursor should replace the system cursor: ${JSON.stringify(p)}`
    : f.field !== 'text' || f.opacity > 0.05 ? `the URL field should show the text cursor, not the ring: ${JSON.stringify(f)}`
    : !(b.scale > 1.4) ? `the ring should grow over a button: ${JSON.stringify(b)}`
    : !(left.follow < -0.5 && right.follow > 0.5) ? `the hero link should turn to the mouse: left ${left.follow}, right ${right.follow}`
    : out.on || out.page === 'none' ? `out of the window, the system cursor should be back: ${JSON.stringify(out)}`
    : null;
  return { field: f.field, buttonScale: b.scale, follow: [left.follow, right.follow], problem };
}

/**
 * The 3D journey's moments. Live: scrolls down until each milestone (scroll progress from the dev-only
 * window.xpProgress), screenshots it, and decodes the QR code while it holds at the end of its moment. Reduced
 * motion: decodes the QR code's still frame. Either way the code must scan to this site.
 */
async function checkJourney(page, width, path) {
  const expected = `http://localhost:${WEB_PORT}/`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (REDUCED) {
    await page.evaluate(() => document.querySelector('[data-xp-anchor="qr"]').scrollIntoView({ block: 'center' }));
    await sleep(400);
    const shot = await shootBox(page, '[data-xp-anchor="qr"]');
    await writeFile(join(shotsDir, `${width}-${slug(path)}-qr-still-crop.png`), shot);
    const decoded = decodeQr(shot);
    return { qr: decoded, problem: decoded === expected ? null : `QR still decodes to ${JSON.stringify(decoded)}, expected ${expected}` };
  }
  const milestones = [
    ['toShare', 0.5], ['share', 0.25], ['share', 0.5], ['share', 0.75], ['share', 0.95], ['toKnow', 0.65], ['know', 0.5], ['know', 1],
    ['toWhere', 0.6], ['toWhere', 1], ['toTest', 0.6], ['test', 0.4], ['test', 1], ['toProtect', 0.6], ['protect', 0.4], ['protect', 1],
    ['toPricing', 0.6], ['toPricing', 1], ['toCta', 0.5], ['toCta', 1],
  ];
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  let y = 0;
  let decoded = null;
  const missed = [];
  for (const [key, target] of milestones) {
    // Walk down until the milestone is reached: progress only grows as the page scrolls down.
    while (y < total && (await page.evaluate((key) => window.xpProgress?.[key] ?? -1, key)) < target - 1e-6) {
      y += 12;
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await sleep(16);
    }
    if (y >= total) { missed.push(`${key} ${target}`); continue; }
    await sleep(500);
    await page.screenshot({ path: join(shotsDir, `${width}-${slug(path)}-journey-${key}-${target}.png`) });
    if (key === 'share' && target === 0.95) {
      const shot = await shootBox(page, '[data-xp-anchor="qr"]');
      await writeFile(join(shotsDir, `${width}-${slug(path)}-qr-crop.png`), shot);
      decoded = decodeQr(shot);
    }
  }
  const tier = await page.evaluate(() => window.xpTier?.() ?? null);
  const problem = missed.length ? `never reached ${missed.join(', ')} (tier ${tier})`
    : decoded !== expected ? `QR at the end of its moment decodes to ${JSON.stringify(decoded)}, expected ${expected}`
    : null;
  return { qr: decoded, tier, problem };
}

/** Share of a PNG's pixels that differ clearly from its most common colour (the page behind): something is drawn. */
function coverage(buffer) {
  const { data, width, height } = PNG.sync.read(Buffer.from(buffer));
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const background = [(top >> 8) * 16 + 8, ((top >> 4) & 15) * 16 + 8, (top & 15) * 16 + 8];
  let drawn = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i] - background[0]) + Math.abs(data[i + 1] - background[1]) + Math.abs(data[i + 2] - background[2]) > 60) drawn++;
  }
  return drawn / (width * height);
}

/**
 * Pricing: the link drops in once its spot above the Pro card is on screen and settles there (live), or is drawn
 * there as a still (reduced motion). Checked by what's actually painted in that box.
 */
async function checkDrop(page, width) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await page.evaluate(() => document.querySelector('[data-xp-anchor="pricing"]').scrollIntoView({ block: 'center' }));
  if (!REDUCED) {
    const landed = await settle(page.waitForFunction(() => (window.xpProgress?.drop ?? 0) >= 1, { timeout: 8000 })).then(() => true, () => false);
    if (!landed) return { problem: 'the link never finished dropping in' };
  }
  await sleep(500);
  const shot = await shootBox(page, '[data-xp-anchor="pricing"]', 16);
  await writeFile(join(shotsDir, `${width}-pricing-link${REDUCED ? '-reduced' : ''}.png`), shot);
  const painted = coverage(shot);
  return { painted: Number(painted.toFixed(3)), problem: painted < 0.03 ? `almost nothing drawn above the Pro card (${(painted * 100).toFixed(1)} % of the box)` : null };
}

/**
 * FPS=1: at each moment of the journey, the median frame rate over 90 frames must reach `target` (spec §4.7:
 * 55 desktop, 45 phone tier). Also reports the slowest 10 % of frames. Run on the real GPU (see gpuArgs).
 */
async function checkFrameRate(page, target, kind) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Pricing: once the link has landed (drop = 1), at the top and with the comparison table on screen.
  const stops = kind === 'pricing' ? [['drop', 1], ['table', 0]]
    : [['toShare', 0], ['toShare', 0.5], ['share', 0.5], ['know', 0.5], ['toWhere', 1], ['test', 0.5], ['protect', 0.5], ['toPricing', 1], ['toCta', 1]];
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const samples = [];
  let y = 0;
  for (const [key, at] of stops) {
    if (key === 'table') await page.evaluate(() => document.querySelector('table').scrollIntoView({ block: 'center' }));
    else if (key === 'drop') await settle(page.waitForFunction(() => (window.xpProgress?.drop ?? 0) >= 1, { timeout: 8000 })).catch(() => undefined);
    else while (y < total && (await page.evaluate((key) => window.xpProgress?.[key] ?? -1, key)) < at - 1e-6) {
      y += 24;
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await sleep(8);
    }
    await sleep(400);
    const { median, slow } = await page.evaluate(() => new Promise((done) => {
      const times = [];
      const tick = (t) => {
        times.push(t);
        if (times.length < 91) return requestAnimationFrame(tick);
        const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
        done({ median: 1000 / gaps[gaps.length >> 1], slow: 1000 / gaps[Math.floor(gaps.length * 0.9)] });
      };
      requestAnimationFrame(tick);
    }));
    samples.push({ at: `${key} ${at}`, median: Math.round(median), slow: Math.round(slow) });
  }
  const low = samples.filter((s) => s.median < target);
  const tier = await page.evaluate(() => window.xpTier?.() ?? null);
  return { tier, samples: samples.map((s) => `${s.at}: ${s.median} (slowest 10% ${s.slow})`), problem: low.length ? `below ${target} fps at ${low.map((s) => s.at).join(', ')}` : null };
}

/**
 * ROUNDS=n: go to /about and back n times with the site's own links. Away, nothing of the 3D may remain (canvases,
 * WebGL contexts, pins, Lenis) and no animation frames may run; back, exactly one context. Reports the JS heap too.
 */
async function checkRoundTrips(page, rounds, path) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const state = () => page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    contexts: window.__glLive,
    pins: document.querySelectorAll('.pin-spacer').length,
    lenis: document.documentElement.classList.contains('lenis'),
  }));
  const heap = async () => page.evaluate(() => { window.gc?.(); return Math.round(performance.memory.usedJSHeapSize / 1e5) / 10; });
  const heaps = [await heap()];
  const problems = [];
  let away = null;
  let back = null;
  for (let i = 1; i <= rounds; i++) {
    await page.click('footer a[href="/about"]');
    await settle(page.waitForSelector('app-about'));
    await sleep(400);
    away = await state();
    if (away.canvases || away.contexts || away.pins || away.lenis) problems.push(`round ${i} away: ${JSON.stringify(away)}`);
    if (i === rounds) {
      await sleep(4000); // GSAP's ticker sleeps ~120 frames after its last listener goes
      const before = await page.evaluate(() => window.__frames);
      await sleep(1000);
      const frames = (await page.evaluate(() => window.__frames)) - before;
      if (frames) problems.push(`${frames} animation frames/s on /about after leaving`);
    }
    await page.click(path === '/' ? 'a[aria-label="Zelqit home"]' : `footer a[href="${path}"]`);
    await settle(page.waitForFunction(() => Boolean(document.querySelector('[data-xp-anchor][data-xp-drawn]')), { timeout: 15000 }));
    back = await state();
    if (back.contexts !== 1) problems.push(`round ${i} back: ${back.contexts} WebGL contexts`);
    heaps.push(await heap());
  }
  return { away, back, heapMB: heaps.join(' → '), problem: problems.join('; ') || null };
}

/** PHONE=1: a phone starts on a lighter tier, and the 3D canvas draws at most 1.5 pixels per CSS pixel. */
async function checkPhone(page) {
  return page.evaluate(() => {
    const tier = window.xpTier?.() ?? null;
    const gl = [...document.querySelectorAll('canvas')].find((c) => getComputedStyle(c).position === 'fixed' && c.style.zIndex !== '-2');
    const ratio = gl ? gl.width / gl.clientWidth : null;
    const problem = tier === 'high' ? 'a phone started on the high tier' : ratio !== null && ratio > 1.5 + 1e-6 ? `3D pixel ratio ${ratio.toFixed(2)} > 1.5 (device ${devicePixelRatio})` : null;
    return { tier, pixelRatio: ratio && Number(ratio.toFixed(2)), devicePixelRatio, problem };
  });
}

/**
 * THROTTLE=n: with the CPU slowed, keep scrolling until the frame-rate guard lowers the tier (it never raises it).
 * If it drops to stills, the live canvases must be gone and the page must stop requesting animation frames.
 */
async function checkDowngrade(page) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = () => page.evaluate(() => window.xpTier?.() ?? null);
  const start = await read();
  const seen = start === 'still' ? ['live', start] : [start]; // a fast page can switch before we look
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && seen[seen.length - 1] !== 'still') {
    await page.evaluate(() => window.scrollBy(0, 60));
    await sleep(250);
    const tier = await read();
    if (tier !== seen[seen.length - 1]) seen.push(tier);
  }
  const result = { tiers: seen.join(' → ') };
  if (seen.length === 1) return { ...result, problem: `no downgrade from ${start} within 20 s` };
  if (seen[seen.length - 1] === 'still') {
    await sleep(4000); // GSAP's ticker sleeps ~120 frames after its last listener goes
    const before = await page.evaluate(() => window.__frames);
    await sleep(1000);
    const frames = (await page.evaluate(() => window.__frames)) - before;
    const live = await page.evaluate(() => [...document.querySelectorAll('canvas')].filter((c) => getComputedStyle(c).position === 'fixed').length);
    const [stills, anchors] = await page.evaluate(() => [document.querySelectorAll('[data-xp-anchor] > canvas').length, document.querySelectorAll('[data-xp-anchor]').length]);
    Object.assign(result, { framesPerSecondAfter: frames, liveCanvases: live, stillCanvases: stills });
    if (live || stills !== anchors || frames > 0) return { ...result, problem: `after switching to stills: ${live} live canvases, ${stills} stills, ${frames} frames/s` };
  }
  return { ...result, problem: null };
}

// --- INTERACT=1: keyboard + drawer checks on the links page ------------------------------------------
if (process.env.INTERACT) {
  const checks = [];
  for (const w of [1280, 360]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 800 });
    await page.evaluateOnNewDocument((t, u) => { localStorage.setItem('token', t); localStorage.setItem('user', u); }, token, user);
    const seen = [];
    page.on('request', (r) => seen.push(r.url().replace('http://localhost:', ':').slice(0, 80)));
    // Wait for the list itself (network-idle can hang on external font downloads in headless Chrome).
    await page.goto(`http://localhost:${WEB_PORT}/app/links`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(`[...document.querySelectorAll('button')].some((b) => b.offsetParent !== null && ((b.getAttribute('aria-label') ?? '').startsWith('Delete') || b.textContent.trim() === 'Delete'))`, { timeout: 15000 });
    if (seen.filter((u) => u.includes('/api/me')).length > 3) console.log(`${w}px WARNING: /api/me requested ${seen.filter((u) => u.includes('/api/me')).length} times`);
    const inDialog = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]')));
    const dialogOpen = () => page.evaluate(() => Boolean(document.querySelector('[role=dialog]')));
    const tabAround = async (n) => { let inside = true; for (let i = 0; i < n; i++) { await page.keyboard.press('Tab'); inside = inside && (await inDialog()); } return inside; };

    // Delete confirmation (modal): the first *visible* Delete button (the desktop table stays in the DOM, hidden, on phones).
    await page.evaluate(() => {
      const isDelete = (b) => (b.getAttribute('aria-label') ?? '').startsWith('Delete') || b.textContent.trim() === 'Delete';
      [...document.querySelectorAll('button')].find((b) => b.offsetParent !== null && isDelete(b)).click();
    });
    await page.waitForSelector('[role=dialog]');
    checks.push(`${w}px modal: focus starts inside=${await inDialog()}, stays inside after 15 Tabs=${await tabAround(15)}`);
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 200));
    checks.push(`${w}px modal: closed by Escape=${!(await dialogOpen())}`);

    // Editor (drawer)
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('New link')).click());
    await page.waitForSelector('[role=dialog]');
    await new Promise((r) => setTimeout(r, 300));
    const overflow = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return { scroll: d.scrollWidth > d.clientWidth + 1, pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
    checks.push(`${w}px drawer: focus inside=${await inDialog()}, stays inside after 40 Tabs=${await tabAround(40)}, drawer overflows=${overflow.scroll}, page scrolls=${overflow.pageScroll}`);
    await page.screenshot({ path: join(shotsDir, `${w}-editor.png`) });
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 200));
    checks.push(`${w}px drawer: closed by Escape=${!(await dialogOpen())}`);
    await page.close();
  }
  console.log('INTERACT\n  ' + checks.join('\n  '));
}

await browser.close();
web.close();
// Wait for the backend's graceful shutdown (it closes its DB connection) before the database goes away.
await new Promise((done) => {
  if (api.exitCode !== null || api.signalCode !== null) return done();
  api.once('exit', done);
  api.kill('SIGTERM');
  setTimeout(() => api.kill('SIGKILL'), 5000).unref();
});
await mongoose.disconnect();
await mongo.stop();
const problems = results.filter((r) => r.horizontalScroll || r.overflowing.length || r.errors.length);
console.log(JSON.stringify({ pages: results.length, problems: problems.length }, null, 1));
for (const r of problems) {
  console.log(`${r.w}px ${r.path} scroll=${r.horizontalScroll} (${r.scrollW}/${r.vw}) over=${JSON.stringify(r.overflowing)} errors=${JSON.stringify(r.errors)}`);
  if (ONLY) console.log('  smallest culprits:\n    ' + r.smallest.join('\n    '));
}
for (const r of results.filter((r) => r.xp)) {
  const { cursor, sections, journey, drop, downgrade, phone, frameRate, rounds, ...facts } = r.xp;
  const mode = [REDUCED && 'reduced motion', PHONE && 'phone', THROTTLE && `CPU ÷${THROTTLE}`, SLOW && `+${SLOW} ms/frame`, FPS && 'real GPU'].filter(Boolean).join(', ');
  console.log(`3D ${r.path} ${r.w}px${mode ? ` (${mode})` : ''}: ${JSON.stringify(facts)}${cursor ? `\n  cursor: ${JSON.stringify(cursor)}` : ''}${sections ? `\n  sections: ${sections.join(' · ')}` : ''}${drop ? `\n  pricing link: ${JSON.stringify(drop)}` : ''}${journey ? `\n  journey: QR → ${JSON.stringify(journey.qr)}${journey.tier ? ` · tier ${journey.tier}` : ''}` : ''}${downgrade ? `\n  downgrade: ${JSON.stringify(downgrade)}` : ''}${phone ? `\n  phone: ${JSON.stringify(phone)}` : ''}${frameRate ? `\n  frame rate (tier ${frameRate.tier}):\n    ${frameRate.samples.join('\n    ')}` : ''}${rounds ? `\n  round trips: ${JSON.stringify(rounds)}` : ''}`);
}
for (const r of results.filter((r) => r.dash)) {
  const { problem, ...facts } = r.dash;
  console.log(`DASHBOARD ${r.path}${r.account === 'new' ? ' (new account)' : ''} ${r.w}px${REDUCED ? ' (reduced motion)' : SLOW ? ` (+${SLOW} ms/frame)` : ''}: ${JSON.stringify(facts)}`);
}
console.log('titles/h1 sample:', results.filter((r) => r.w === widths[widths.length - 1].w).map((r) => `${r.path} → ${r.h1}`).join(' | '));
if (/error/i.test(apiLog)) console.log('API LOG:', apiLog.slice(0, 800));
process.exitCode = problems.length ? 1 : 0;
