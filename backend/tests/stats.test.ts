import request from 'supertest';
import { Click } from '../src/models/click';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000);
const dateStr = (offset: number) => day(offset).toISOString().slice(0, 10);

async function setup() {
  const app = testApp();
  const alice = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  const bob = { Authorization: `Bearer ${await loginAs(app, 'bob')}` };
  const link = (await request(app).post('/api/links').set(alice).send({ url: 'https://example.com' })).body;

  const human = { link: link.id, isBot: false, browser: 'Chrome', os: 'macOS', deviceType: 'desktop' };
  await Click.insertMany([
    { ...human, ts: day(2), referrer: 'google.com', visitorHash: 'v1' },
    { ...human, ts: day(2), referrer: 'google.com', visitorHash: 'v1' },
    { ...human, ts: day(0), referrer: '', visitorHash: 'v2', browser: 'Mobile Safari', os: 'iOS', deviceType: 'mobile' },
    { ...human, ts: day(0), referrer: 't.co', visitorHash: 'v3' },
    { link: link.id, isBot: true, ts: day(0), referrer: '', browser: 'Unknown', os: 'Unknown', deviceType: 'desktop', visitorHash: 'bot1' },
  ]);
  return { app, alice, bob, link };
}

describe('GET /api/links/:id/stats', () => {
  it('returns human-only stats by default', async () => {
    const { app, alice, link } = await setup();
    const res = await request(app).get(`/api/links/${link.id}/stats`).set(alice);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      link: link,
      includeBots: false,
      total: 4,
      uniqueVisitors: 3,
      botClicks: 1,
      clicksPerDay: [
        { date: dateStr(2), count: 2 },
        { date: dateStr(1), count: 0 },
        { date: dateStr(0), count: 2 },
      ],
      referrers: [
        { value: 'google.com', count: 2 },
        { value: 'direct', count: 1 },
        { value: 't.co', count: 1 },
      ],
      browsers: [
        { value: 'Chrome', count: 3 },
        { value: 'Mobile Safari', count: 1 },
      ],
      os: [
        { value: 'macOS', count: 3 },
        { value: 'iOS', count: 1 },
      ],
      devices: [
        { value: 'desktop', count: 3 },
        { value: 'mobile', count: 1 },
      ],
    });
  });

  it('includes bots when bots=true', async () => {
    const { app, alice, link } = await setup();
    const res = await request(app).get(`/api/links/${link.id}/stats?bots=true`).set(alice);
    expect(res.body).toMatchObject({ includeBots: true, total: 5, uniqueVisitors: 4, botClicks: 1 });
    expect(res.body.clicksPerDay.at(-1)).toEqual({ date: dateStr(0), count: 3 });
    expect(res.body.referrers[0]).toEqual({ value: 'direct', count: 2 });
  });

  it('returns empty stats for a link with no clicks', async () => {
    const { app, alice } = await setup();
    const fresh = (await request(app).post('/api/links').set(alice).send({ url: 'https://new.com' })).body;
    const res = await request(app).get(`/api/links/${fresh.id}/stats`).set(alice);
    expect(res.body).toMatchObject({ total: 0, uniqueVisitors: 0, botClicks: 0, clicksPerDay: [], referrers: [] });
  });

  it("returns 404 for another user's link", async () => {
    const { app, bob, link } = await setup();
    expect((await request(app).get(`/api/links/${link.id}/stats`).set(bob)).status).toBe(404);
  });

  it('counts real redirects end to end', async () => {
    const { app, alice } = await setup();
    const fresh = (await request(app).post('/api/links').set(alice).send({ url: 'https://new.com', alias: 'e2e' })).body;
    await request(app).get('/e2e').set('Referer', 'https://github.com/x');
    await request(app).get('/e2e').set('Referer', 'https://github.com/y');
    const res = await request(app).get(`/api/links/${fresh.id}/stats`).set(alice);
    expect(res.body).toMatchObject({ total: 2, uniqueVisitors: 1, referrers: [{ value: 'github.com', count: 2 }] });
  });
});
