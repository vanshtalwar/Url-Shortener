import request from 'supertest';
import { User } from '../src/models/user';
import { pickVariant } from '../src/variants';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const A = { url: 'https://a.example.com', weight: 1 };
const B = { url: 'https://b.example.com', weight: 3 };

describe('pickVariant', () => {
  it('splits by relative weight', () => {
    // total weight 4: [0, 0.25) → A, [0.25, 1) → B
    expect(pickVariant([A, B], 0).url).toBe(A.url);
    expect(pickVariant([A, B], 0.2499).url).toBe(A.url);
    expect(pickVariant([A, B], 0.25).url).toBe(B.url);
    expect(pickVariant([A, B], 0.9999).url).toBe(B.url);
  });
});

async function setup(pro = true) {
  let next = 0;
  const randoms = [0.1, 0.9, 0.9]; // A, B, B
  const app = testApp({ random: () => randoms[next++ % randoms.length] });
  const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  if (pro) {
    await User.updateOne({ email: 'alice@example.com' }, { subscription: { id: 's', status: 'active', interval: 'monthly', currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
  }
  return { app, auth };
}

describe('A/B variants', () => {
  it('redirects by weight and reports clicks per destination', async () => {
    const { app, auth } = await setup();
    const link = (await request(app).post('/api/links').set(auth).send({ url: 'https://main.com', alias: 'split', variants: [A, B] })).body;
    expect(link.variants).toEqual([A, B]);

    const locations = [];
    for (let i = 0; i < 3; i++) locations.push((await request(app).get('/split')).headers.location);
    expect(locations).toEqual([A.url, B.url, B.url]);

    const stats = (await request(app).get(`/api/links/${link.id}/stats`).set(auth)).body;
    expect(stats.variants).toEqual([{ url: A.url, clicks: 1 }, { url: B.url, clicks: 2 }]);
  });

  it('keeps per-destination history when weights change', async () => {
    const { app, auth } = await setup();
    const link = (await request(app).post('/api/links').set(auth).send({ url: 'https://main.com', alias: 'split', variants: [A, B] })).body;
    await request(app).get('/split'); // → A
    await request(app).patch(`/api/links/${link.id}`).set(auth).send({ variants: [B, { ...A, weight: 50 }] });
    const stats = (await request(app).get(`/api/links/${link.id}/stats`).set(auth)).body;
    expect(stats.variants).toEqual([{ url: B.url, clicks: 0 }, { url: A.url, clicks: 1 }]);
  });

  it('removing variants ([]) goes back to the main destination', async () => {
    const { app, auth } = await setup();
    const link = (await request(app).post('/api/links').set(auth).send({ url: 'https://main.com', alias: 'split', variants: [A, B] })).body;
    await request(app).patch(`/api/links/${link.id}`).set(auth).send({ variants: [] });
    expect((await request(app).get('/split')).headers.location).toBe('https://main.com');
  });

  it.each([
    [[A]],
    [[A, B, A, B, A, B]],
    [[A, { url: 'nope', weight: 1 }]],
    [[A, { url: 'https://c.com', weight: 0 }]],
    [[A, { url: 'https://c.com', weight: 1.5 }]],
  ])('rejects invalid variants %j', async (variants) => {
    const { app, auth } = await setup();
    expect((await request(app).post('/api/links').set(auth).send({ url: 'https://main.com', variants })).status).toBe(400);
  });

  it('is Pro-only to create; keeps splitting (read-only) after a downgrade', async () => {
    const { app, auth } = await setup();
    const link = (await request(app).post('/api/links').set(auth).send({ url: 'https://main.com', alias: 'split', variants: [A, B] })).body;
    await User.updateOne({ email: 'alice@example.com' }, { subscription: null });

    expect((await request(app).get('/split')).headers.location).toBe(A.url); // still splits
    const edit = await request(app).patch(`/api/links/${link.id}`).set(auth).send({ variants: [] });
    expect(edit.status).toBe(403);
    expect(edit.body.code).toBe('PRO_FEATURE');
    const create = await request(app).post('/api/links').set(auth).send({ url: 'https://x.com', variants: [A, B] });
    expect(create.status).toBe(403);
  });
});
