import request from 'supertest';
import { Click } from '../src/models/click';
import { User } from '../src/models/user';
import { fillDays } from '../src/stats';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const dateOf = (n: number) => daysAgo(n).toISOString().slice(0, 10);

async function setup() {
  const app = testApp();
  const alice = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  const bob = { Authorization: `Bearer ${await loginAs(app, 'bob')}` };
  const mk = async (auth: object, alias: string) =>
    (await request(app).post('/api/links').set(auth as Record<string, string>).send({ url: 'https://x.com', alias })).body.id;
  const [a1, a2, b1] = [await mk(alice, 'alice-one'), await mk(alice, 'alice-two'), await mk(bob, 'bob-one')];
  const click = (link: string, ago: number, visitorHash: string, isBot = false) => ({ link, clickedAt: daysAgo(ago), visitorHash, isBot });
  await Click.insertMany([
    click(a1, 0, 'v1'),
    click(a1, 0, 'v1'),
    click(a1, 2, 'v2'),
    click(a2, 1, 'v3'),
    click(a2, 1, 'bot', true), // bots excluded
    click(a1, 50, 'v9'), // outside 30 days
    click(b1, 0, 'v4'), // another user's
  ]);
  return { app, alice };
}

describe('GET /api/stats/overview', () => {
  it('totals, a gap-filled chart over the whole window, and top links for the caller only', async () => {
    const { app, alice } = await setup();
    const res = await request(app).get('/api/stats/overview?days=7').set(alice);
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(res.body.totals).toEqual({ clicks: 4, uniques: 3, links: 2 });
    expect(res.body.clicksPerDay).toHaveLength(7);
    expect(res.body.clicksPerDay[0]).toEqual({ date: dateOf(6), count: 0 });
    expect(res.body.clicksPerDay.at(-1)).toEqual({ date: dateOf(0), count: 2 });
    expect(res.body.topLinks).toEqual([
      { id: expect.any(String), code: 'alice-one', clicks: 3 },
      { id: expect.any(String), code: 'alice-two', clicks: 1 },
    ]);
  });

  it('caps Free at 30 days; Pro gets 90', async () => {
    const { app, alice } = await setup();
    const free = (await request(app).get('/api/stats/overview?days=90').set(alice)).body;
    expect(free.days).toBe(30);
    expect(free.totals.clicks).toBe(4);

    await User.updateOne({ email: 'alice@example.com' }, { subscription: { id: 's', status: 'active', interval: 'yearly', currentPeriodEnd: daysAgo(-30) } });
    const pro = (await request(app).get('/api/stats/overview?days=90').set(alice)).body;
    expect(pro.days).toBe(90);
    expect(pro.totals.clicks).toBe(5);
    expect(pro.clicksPerDay).toHaveLength(90);
  });

  it('rejects other ranges', async () => {
    const { app, alice } = await setup();
    expect((await request(app).get('/api/stats/overview?days=14').set(alice)).status).toBe(400);
  });
});

describe('fillDays with a start day', () => {
  it('starts at the given day even without clicks', () => {
    expect(fillDays([], '2026-01-03', '2026-01-01')).toEqual([
      { date: '2026-01-01', count: 0 },
      { date: '2026-01-02', count: 0 },
      { date: '2026-01-03', count: 0 },
    ]);
  });
});
