import { createHmac } from 'node:crypto';
import request from 'supertest';
import { User } from '../src/models/user';
import { fakeBilling, loginAs, testApp, useTestDb } from './helpers';

useTestDb();

const KEY_SECRET = 'test-key-secret';
const WEBHOOK_SECRET = 'test-webhook-secret';
const hmac = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('hex');
const inDays = (d: number) => Math.floor(Date.now() / 1000) + d * 86_400;

async function setup() {
  const billing = fakeBilling();
  const app = testApp({ billing });
  const auth = { Authorization: `Bearer ${await loginAs(app, 'alice')}` };
  return { app, auth, billing };
}

/** Subscribe, then pretend Razorpay activated it and the browser verified the payment. */
async function becomePro(ctx: Awaited<ReturnType<typeof setup>>) {
  const { subscriptionId } = (await request(ctx.app).post('/api/billing/subscribe').set(ctx.auth).send({ interval: 'monthly' })).body;
  ctx.billing.state.set(subscriptionId, { id: subscriptionId, status: 'active', current_end: inDays(30) });
  const res = await request(ctx.app)
    .post('/api/billing/verify')
    .set(ctx.auth)
    .send({ razorpay_payment_id: 'pay_1', razorpay_subscription_id: subscriptionId, razorpay_signature: hmac(`pay_1|${subscriptionId}`, KEY_SECRET) });
  return { subscriptionId, res };
}

function webhook(app: ReturnType<typeof testApp>, body: object, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(body);
  return request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', hmac(raw, secret)).send(raw);
}

const event = (name: string, sub: object, createdAt: number) => ({ event: name, created_at: createdAt, payload: { subscription: { entity: sub } } });

describe('subscribe + verify', () => {
  it('creates a Razorpay subscription for the chosen plan and returns what Checkout needs', async () => {
    const { app, auth, billing } = await setup();
    const res = await request(app).post('/api/billing/subscribe').set(auth).send({ interval: 'yearly' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscriptionId: 'sub_1', keyId: 'rzp_test_key' });
    expect(billing.calls[0]).toEqual({ method: 'create', args: ['plan_yearly', 10, { userId: expect.any(String) }] });
    expect((await User.findOne())!.subscription).toMatchObject({ id: 'sub_1', status: 'created', interval: 'yearly' });
  });

  it('rejects an unknown interval', async () => {
    const { app, auth } = await setup();
    expect((await request(app).post('/api/billing/subscribe').set(auth).send({ interval: 'weekly' })).status).toBe(400);
  });

  it('verifies the payment signature and upgrades to Pro using Razorpay’s own status', async () => {
    const ctx = await setup();
    const { res } = await becomePro(ctx);
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
    expect(res.body.subscription).toMatchObject({ status: 'active', interval: 'monthly', cancelAtPeriodEnd: false });
  });

  it.each([
    ['a wrong signature', (id: string) => ({ razorpay_payment_id: 'pay_1', razorpay_subscription_id: id, razorpay_signature: hmac('nope', KEY_SECRET) })],
    ['a garbage signature', (id: string) => ({ razorpay_payment_id: 'pay_1', razorpay_subscription_id: id, razorpay_signature: 'xyz' })],
    ['someone else’s subscription id', () => ({ razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_other', razorpay_signature: hmac('pay_1|sub_other', KEY_SECRET) })],
  ])('refuses %s', async (_label, body) => {
    const { app, auth } = await setup();
    const { subscriptionId } = (await request(app).post('/api/billing/subscribe').set(auth).send({ interval: 'monthly' })).body;
    const res = await request(app).post('/api/billing/verify').set(auth).send(body(subscriptionId));
    expect(res.status).toBe(400);
    expect((await request(app).get('/api/me').set(auth)).body.plan).toBe('free');
  });

  it('refuses to subscribe again while Pro', async () => {
    const ctx = await setup();
    await becomePro(ctx);
    const res = await request(ctx.app).post('/api/billing/subscribe').set(ctx.auth).send({ interval: 'yearly' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_PRO');
  });
});

describe('webhooks', () => {
  it('rejects a bad signature', async () => {
    const { app } = await setup();
    expect((await webhook(app, event('subscription.activated', { id: 'sub_1', status: 'active' }, 1), 'wrong-secret')).status).toBe(400);
  });

  it('activates, then a halted payment drops back to Free', async () => {
    const ctx = await setup();
    const { subscriptionId } = (await request(ctx.app).post('/api/billing/subscribe').set(ctx.auth).send({ interval: 'monthly' })).body;
    await webhook(ctx.app, event('subscription.activated', { id: subscriptionId, status: 'active', current_end: inDays(30) }, 100));
    expect((await request(ctx.app).get('/api/me').set(ctx.auth)).body.plan).toBe('pro');
    await webhook(ctx.app, event('subscription.halted', { id: subscriptionId, status: 'halted', current_end: inDays(30) }, 200));
    expect((await request(ctx.app).get('/api/me').set(ctx.auth)).body.plan).toBe('free');
  });

  it('ignores an older event that arrives late, and repeating an event changes nothing', async () => {
    const ctx = await setup();
    const { subscriptionId } = (await request(ctx.app).post('/api/billing/subscribe').set(ctx.auth).send({ interval: 'monthly' })).body;
    const halted = event('subscription.halted', { id: subscriptionId, status: 'halted' }, 200);
    await webhook(ctx.app, halted);
    await webhook(ctx.app, event('subscription.activated', { id: subscriptionId, status: 'active', current_end: inDays(30) }, 100));
    await webhook(ctx.app, halted);
    expect((await User.findOne())!.subscription).toMatchObject({ status: 'halted', lastEventAt: 200 });
  });

  it('acknowledges events it doesn’t handle or for unknown subscriptions', async () => {
    const { app } = await setup();
    expect((await webhook(app, { event: 'payment.captured', created_at: 1, payload: {} })).status).toBe(200);
    expect((await webhook(app, event('subscription.activated', { id: 'sub_unknown', status: 'active' }, 1))).status).toBe(200);
  });
});

describe('cancel', () => {
  it('cancels at the end of the paid period: still Pro now, Free after Razorpay ends it', async () => {
    const ctx = await setup();
    const { subscriptionId } = await becomePro(ctx);
    const res = await request(ctx.app).post('/api/billing/cancel').set(ctx.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plan: 'pro', subscription: { cancelAtPeriodEnd: true } });
    expect(ctx.billing.calls.at(-1)).toEqual({ method: 'cancel', args: [subscriptionId] });

    // Cycle ends: Razorpay reports cancelled with a period end in the past.
    const later = Math.floor(Date.now() / 1000) + 10;
    await webhook(ctx.app, event('subscription.cancelled', { id: subscriptionId, status: 'cancelled', current_end: inDays(-1) }, later));
    expect((await request(ctx.app).get('/api/me').set(ctx.auth)).body.plan).toBe('free');
  });

  it('refuses to cancel twice or without a subscription', async () => {
    const ctx = await setup();
    expect((await request(ctx.app).post('/api/billing/cancel').set(ctx.auth)).status).toBe(409);
    await becomePro(ctx);
    await request(ctx.app).post('/api/billing/cancel').set(ctx.auth);
    expect((await request(ctx.app).post('/api/billing/cancel').set(ctx.auth)).status).toBe(409);
  });
});

describe('GET /api/billing', () => {
  it('returns plan and subscription summary', async () => {
    const ctx = await setup();
    expect((await request(ctx.app).get('/api/billing').set(ctx.auth)).body).toEqual({ plan: 'free', subscription: null });
    await becomePro(ctx);
    expect((await request(ctx.app).get('/api/billing').set(ctx.auth)).body).toMatchObject({ plan: 'pro', subscription: { status: 'active' } });
  });
});
