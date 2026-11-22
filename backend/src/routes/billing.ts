import { Router, type RequestHandler } from 'express';
import { config } from '../config';
import { accountOf } from '../middleware/account';
import { User } from '../models/user';
import { buildMe } from '../me';
import { TOTAL_CYCLES, periodEnd, signatureMatches, type BillingGateway, type GatewaySubscription, type Interval } from '../billing';

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.pending',
  'subscription.halted',
  'subscription.cancelled',
  'subscription.completed',
  'subscription.resumed',
  'subscription.paused',
]);

/**
 * Applies Razorpay's view of a subscription to the user who owns it. Atomic and ordered: an event older than the
 * last one applied is ignored, so retried or out-of-order webhooks can't roll the status back.
 */
async function applySubscription(sub: GatewaySubscription, eventTime: number): Promise<void> {
  await User.updateOne(
    {
      'subscription.id': sub.id,
      $or: [{ 'subscription.lastEventAt': null }, { 'subscription.lastEventAt': { $lte: eventTime } }],
    },
    {
      $set: {
        'subscription.status': sub.status,
        'subscription.currentPeriodEnd': periodEnd(sub),
        'subscription.lastEventAt': eventTime,
      },
    },
  );
}

/** Expects requireAuth + loadAccount. */
export function billingRouter(gateway: BillingGateway) {
  const router = Router();
  const planIds: Record<Interval, string> = { monthly: config.razorpay.planMonthly, yearly: config.razorpay.planYearly };

  // After a change, re-read the user so the response reflects what was just saved.
  const reloadMe = async (userId: string) => buildMe((await User.findById(userId).lean())!);

  router.get('/', async (_req, res) => {
    const { plan, subscription } = await buildMe(accountOf(res).user);
    res.json({ plan, subscription });
  });

  router.post('/subscribe', async (req, res) => {
    const interval: unknown = req.body?.interval;
    if (interval !== 'monthly' && interval !== 'yearly') {
      return void res.status(400).json({ error: "interval must be 'monthly' or 'yearly'" });
    }
    const { user, limits } = accountOf(res);
    // Includes a cancelled plan that's still paid up: subscribing again now would charge twice for the same period.
    if (limits.plan === 'pro') {
      return void res.status(409).json({ error: 'You already have Pro', code: 'ALREADY_PRO' });
    }

    const sub = await gateway.createSubscription(planIds[interval], TOTAL_CYCLES[interval], { userId: user._id.toString() });
    await User.updateOne(
      { _id: user._id },
      { subscription: { id: sub.id, status: sub.status, interval, currentPeriodEnd: null, cancelAtPeriodEnd: false, lastEventAt: null } },
    );
    res.json({ subscriptionId: sub.id, keyId: config.razorpay.keyId });
  });

  // Called by the frontend with Razorpay Checkout's success response.
  router.post('/verify', async (req, res) => {
    const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = req.body ?? {};
    const { user } = accountOf(res);
    const valid =
      typeof paymentId === 'string' &&
      subscriptionId === user.subscription?.id &&
      signatureMatches(`${paymentId}|${subscriptionId}`, signature, config.razorpay.keySecret);
    if (!valid) return void res.status(400).json({ error: 'Payment could not be verified', code: 'INVALID_SIGNATURE' });

    // Ask Razorpay for the authoritative status rather than trusting the browser.
    await applySubscription(await gateway.fetchSubscription(subscriptionId), Math.floor(Date.now() / 1000));
    res.json(await reloadMe(res.locals.userId));
  });

  router.post('/cancel', async (_req, res) => {
    const { user, limits } = accountOf(res);
    const sub = user.subscription;
    if (!sub || limits.plan !== 'pro' || sub.cancelAtPeriodEnd) {
      return void res.status(409).json({ error: 'There is no active subscription to cancel', code: 'NOT_SUBSCRIBED' });
    }
    const updated = await gateway.cancelAtCycleEnd(sub.id);
    await User.updateOne({ _id: user._id }, { 'subscription.cancelAtPeriodEnd': true });
    await applySubscription(updated, Math.floor(Date.now() / 1000));
    res.json(await reloadMe(res.locals.userId));
  });

  return router;
}

/** Razorpay webhook. Needs the raw request body (mounted with express.raw before express.json). */
export const billingWebhook: RequestHandler = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!signatureMatches(raw, req.get('x-razorpay-signature'), config.razorpay.webhookSecret)) {
    return void res.status(400).json({ error: 'Invalid signature' });
  }
  const event = JSON.parse(raw);
  const sub: GatewaySubscription | undefined = event?.payload?.subscription?.entity;
  if (SUBSCRIPTION_EVENTS.has(event?.event) && sub?.id && typeof event.created_at === 'number') {
    await applySubscription(sub, event.created_at);
  }
  res.status(200).json({ ok: true }); // acknowledge everything else so Razorpay doesn't retry it
};
