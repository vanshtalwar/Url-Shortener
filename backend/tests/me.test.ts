import request from 'supertest';
import { User } from '../src/models/user';
import { Link } from '../src/models/link';
import { loginAs, testApp, useTestDb } from './helpers';

useTestDb();

describe('GET /api/me', () => {
  it('returns the user, Free plan, limits and this month’s usage', async () => {
    const app = testApp();
    const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
    await request(app).post('/api/links').set(auth).send({ url: 'https://a.com' });
    await request(app).post('/api/links').set(auth).send({ url: 'https://b.com' });
    // A link from last month doesn't count.
    // createdAt is immutable in Mongoose, so backdate it with a raw driver update.
    await Link.collection.updateOne({ url: 'https://b.com' }, { $set: { createdAt: new Date('2020-01-01') } });

    const res = await request(app).get('/api/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: expect.any(String), email: 'alice@example.com', emailVerified: true, hasPassword: false, hasGoogle: true, bioHandle: null },
      plan: 'free',
      subscription: null,
      entitlements: {
        linkLimitPerMonth: 25,
        historyDays: 30,
        can: { geo: false, utmPresets: false, folders: false, variants: false, bio: false },
      },
      usage: { linksThisMonth: 1 },
    });
  });

  it('reports Pro for an active subscription', async () => {
    const app = testApp();
    const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
    await User.updateOne(
      { email: 'alice@example.com' },
      { subscription: { id: 'sub_1', status: 'active', interval: 'yearly', currentPeriodEnd: new Date(Date.now() + 86_400_000) } },
    );
    const res = await request(app).get('/api/me').set(auth);
    expect(res.body.plan).toBe('pro');
    expect(res.body.entitlements.linkLimitPerMonth).toBeNull();
    expect(res.body.subscription).toMatchObject({ status: 'active', interval: 'yearly', cancelAtPeriodEnd: false });
    expect(res.body.subscription).not.toHaveProperty('id'); // Razorpay ids stay server-side
  });

  it('requires login', async () => {
    expect((await request(testApp()).get('/api/me')).status).toBe(401);
  });
});
