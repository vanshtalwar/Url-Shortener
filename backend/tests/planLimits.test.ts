import request from 'supertest';
import { Click } from '../src/models/click';
import { Link } from '../src/models/link';
import { User } from '../src/models/user';
import { signToken } from '../src/middleware/auth';
import { fakeMailer, loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const DAY = 86_400_000;

async function freeUser() {
  const app = testApp();
  const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  return { app, auth };
}

async function makePro(status = 'active', currentPeriodEnd = new Date(Date.now() + 30 * DAY)) {
  await User.updateOne({ email: 'alice@example.com' }, { subscription: { id: 'sub_1', status, interval: 'monthly', currentPeriodEnd } });
}

/** Creates `n` links quickly by inserting them directly (createdAt = now). */
async function seedLinks(n: number) {
  const owner = (await User.findOne({ email: 'alice@example.com' }))!._id;
  await Link.insertMany(Array.from({ length: n }, (_, i) => ({ owner, code: `seed${i}`, url: 'https://x.com' })));
}

describe('monthly link limit (Free: 25)', () => {
  it('blocks the 26th link this month with PLAN_LIMIT', async () => {
    const { app, auth } = await freeUser();
    await seedLinks(24);
    expect((await request(app).post('/api/links').set(auth).send({ url: 'https://ok.com' })).status).toBe(201);
    const blocked = await request(app).post('/api/links').set(auth).send({ url: 'https://over.com' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PLAN_LIMIT');
  });

  it("doesn't count links from previous months", async () => {
    const { app, auth } = await freeUser();
    await seedLinks(25);
    await Link.collection.updateMany({}, { $set: { createdAt: new Date('2020-01-01') } });
    expect((await request(app).post('/api/links').set(auth).send({ url: 'https://ok.com' })).status).toBe(201);
  });

  it('does not limit Pro, including a cancelled subscription still inside its paid period', async () => {
    const { app, auth } = await freeUser();
    await seedLinks(25);
    await makePro('cancelled');
    expect((await request(app).post('/api/links').set(auth).send({ url: 'https://ok.com' })).status).toBe(201);
  });

  it('applies the limit again once Pro has ended (editing and deleting still work)', async () => {
    const { app, auth } = await freeUser();
    await seedLinks(25);
    await makePro('halted');
    expect((await request(app).post('/api/links').set(auth).send({ url: 'https://over.com' })).status).toBe(403);
    const link = await Link.findOne({ code: 'seed0' });
    expect((await request(app).patch(`/api/links/${link!._id}`).set(auth).send({ url: 'https://edited.com' })).status).toBe(200);
    expect((await request(app).delete(`/api/links/${link!._id}`).set(auth)).status).toBe(204);
  });
});

describe('email verification before creating links', () => {
  it('blocks an unverified password account with EMAIL_NOT_VERIFIED', async () => {
    const mailer = fakeMailer();
    const app = testApp({ mailer });
    await request(app).post('/api/auth/register').send({ email: 'new@example.com', password: 'long-enough' });
    // Unverified accounts can't log in, so mint a session directly to prove the link route checks too.
    const user = await User.findOne({ email: 'new@example.com' });
    const auth = { Authorization: `Bearer ${signToken(user!._id.toString())}` };
    const res = await request(app).post('/api/links').set(auth).send({ url: 'https://a.com' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('30-day history (Free)', () => {
  async function linkWithOldAndNewClicks(app: ReturnType<typeof testApp>, auth: object) {
    const link = (await request(app).post('/api/links').set(auth as Record<string, string>).send({ url: 'https://a.com', alias: 'hist' })).body;
    const base = { link: link.id, isBot: false, browser: 'Chrome', os: 'macOS', deviceType: 'desktop', referrer: '' };
    await Click.insertMany([
      { ...base, clickedAt: new Date(Date.now() - 40 * DAY), visitorHash: 'old' },
      { ...base, clickedAt: new Date(Date.now() - 1 * DAY), visitorHash: 'new' },
    ]);
    return link;
  }

  it('Free sees only the last 30 days, and is told older clicks are hidden', async () => {
    const { app, auth } = await freeUser();
    const link = await linkWithOldAndNewClicks(app, auth);
    const stats = (await request(app).get(`/api/links/${link.id}/stats`).set(auth)).body;
    expect(stats).toMatchObject({ total: 1, uniqueVisitors: 1, historyLimited: true });
    const listed = (await request(app).get('/api/links').set(auth)).body[0];
    expect(listed.clickCount).toBe(1);
  });

  it('Pro sees full history; hidden clicks were kept, not deleted', async () => {
    const { app, auth } = await freeUser();
    const link = await linkWithOldAndNewClicks(app, auth);
    await makePro();
    const stats = (await request(app).get(`/api/links/${link.id}/stats`).set(auth)).body;
    expect(stats).toMatchObject({ total: 2, historyLimited: false });
    expect((await request(app).get('/api/links').set(auth)).body[0].clickCount).toBe(2);
  });
});
