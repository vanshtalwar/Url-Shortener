import request from 'supertest';
import { Link } from '../src/models/link';
import { Click } from '../src/models/click';
import { listedClickCount, loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

async function setup(body: object = {}) {
  const app = testApp();
  const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  const link = await request(app)
    .post('/api/links')
    .set(auth)
    .send({ url: 'https://example.com/target', alias: 'jump', ...body });
  return { app, auth, link: link.body };
}

describe('GET /:code', () => {
  it('redirects with 302 and records a parsed click', async () => {
    const { app, auth } = await setup();
    const res = await request(app)
      .get('/jump')
      .set('User-Agent', SAFARI_IPHONE)
      .set('Referer', 'https://news.ycombinator.com/item?id=1');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/target');

    const click = await Click.findOne().lean();
    expect(click).toMatchObject({
      referrer: 'news.ycombinator.com',
      browser: 'Mobile Safari',
      os: 'iOS',
      deviceType: 'mobile',
      isBot: false,
    });
    expect(await listedClickCount(app, auth, 'jump')).toBe(1);
  });

  it('records desktop and direct visits', async () => {
    const { app } = await setup();
    await request(app).get('/jump').set('User-Agent', CHROME_MAC);
    expect(await Click.findOne().lean()).toMatchObject({ referrer: '', browser: 'Chrome', deviceType: 'desktop' });
  });

  it('flags bots, still redirects, and does not count them in clickCount', async () => {
    const { app, auth } = await setup();
    const res = await request(app).get('/jump').set('User-Agent', GOOGLEBOT);
    expect(res.status).toBe(302);
    expect((await Click.findOne())!.isBot).toBe(true);
    expect(await listedClickCount(app, auth, 'jump')).toBe(0);
  });

  it('hashes IP + User-Agent into a stable visitor id without storing the IP', async () => {
    const { app } = await setup();
    const visit = (ip: string, ua: string) => request(app).get('/jump').set('X-Forwarded-For', ip).set('User-Agent', ua);
    await visit('203.0.113.7', CHROME_MAC);
    await visit('203.0.113.7', CHROME_MAC);
    await visit('198.51.100.9', CHROME_MAC);
    await visit('203.0.113.7', SAFARI_IPHONE);

    const clicks = await Click.find().sort({ _id: 1 }).lean();
    const hashes = clicks.map((c) => c.visitorHash);
    expect(hashes[0]).toBe(hashes[1]);
    expect(new Set(hashes).size).toBe(3);
    expect(JSON.stringify(clicks)).not.toContain('203.0.113.7');
  });

  it('returns 404 for an unknown code', async () => {
    const { app } = await setup();
    expect((await request(app).get('/nope')).status).toBe(404);
    expect(await Click.countDocuments()).toBe(0);
  });

  it('returns 410 for an expired link and records nothing', async () => {
    const { app } = await setup();
    await Link.updateOne({ code: 'jump' }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).get('/jump')).status).toBe(410);
    expect(await Click.countDocuments()).toBe(0);
  });

  it('still serves /health', async () => {
    const { app } = await setup();
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('stops working after the alias is changed, and the new code keeps the clicks', async () => {
    const { app, auth, link } = await setup();
    await request(app).get('/jump');
    await request(app).patch(`/api/links/${link.id}`).set(auth).send({ alias: 'leap' });
    expect((await request(app).get('/jump')).status).toBe(404);
    expect((await request(app).get('/leap')).status).toBe(302);
    expect(await Click.countDocuments({ link: link.id })).toBe(2);
  });

  it('deleting a link removes its clicks', async () => {
    const { app, auth, link } = await setup();
    await request(app).get('/jump');
    await request(app).delete(`/api/links/${link.id}`).set(auth);
    expect(await Click.countDocuments()).toBe(0);
    expect((await request(app).get('/jump')).status).toBe(404);
  });

  it('redirects HEAD requests without recording a click', async () => {
    const { app } = await setup();
    const res = await request(app).head('/jump').set('User-Agent', CHROME_MAC);
    expect(res.status).toBe(302);
    expect(await Click.countDocuments()).toBe(0);
  });

  it('records an unreadable User-Agent as unknown, not desktop', async () => {
    const { app } = await setup();
    await request(app).get('/jump').set('User-Agent', 'curl/8.4.0');
    expect(await Click.findOne().lean()).toMatchObject({ browser: 'Unknown', os: 'Unknown', deviceType: 'unknown' });
  });

  describe('trust proxy hops', () => {
    async function hashesFor(trustProxyHops: number) {
      const app = testApp({ trustProxyHops });
      const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
      await request(app).post('/api/links').set(auth).send({ url: 'https://example.com', alias: 'hops' });
      // Two visitors behind the same outer proxy (9.9.9.9).
      await request(app).get('/hops').set('X-Forwarded-For', '1.1.1.1, 9.9.9.9').set('User-Agent', CHROME_MAC);
      await request(app).get('/hops').set('X-Forwarded-For', '2.2.2.2, 9.9.9.9').set('User-Agent', CHROME_MAC);
      return new Set((await Click.find().lean()).map((c) => c.visitorHash)).size;
    }

    it('with 1 hop, the proxy IP is taken as the visitor (both look the same)', async () => {
      expect(await hashesFor(1)).toBe(1);
    });

    it('with 2 hops, the real client IPs are used', async () => {
      expect(await hashesFor(2)).toBe(2);
    });
  });
});
