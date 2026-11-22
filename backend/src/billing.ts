import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';

export type Interval = 'monthly' | 'yearly';

/** The parts of a Razorpay subscription we use. `current_end` is a Unix time in seconds. */
export interface GatewaySubscription {
  id: string;
  status: string;
  current_end?: number | null;
}

/** Razorpay calls behind an interface, so tests can use a fake. */
export interface BillingGateway {
  createSubscription(planId: string, totalCount: number, notes: Record<string, string>): Promise<GatewaySubscription>;
  fetchSubscription(id: string): Promise<GatewaySubscription>;
  cancelAtCycleEnd(id: string): Promise<GatewaySubscription>;
}

// Razorpay requires a finite number of billing cycles; ~10 years either way.
export const TOTAL_CYCLES: Record<Interval, number> = { monthly: 120, yearly: 10 };

export function createRazorpayGateway(keyId: string, keySecret: string): BillingGateway {
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return {
    createSubscription: (plan_id, total_count, notes) => razorpay.subscriptions.create({ plan_id, total_count, notes }),
    fetchSubscription: (id) => razorpay.subscriptions.fetch(id),
    cancelAtCycleEnd: (id) => razorpay.subscriptions.cancel(id, true),
  };
}

/** HMAC-SHA256 check with a constant-time comparison; false (never throws) on missing or malformed input. Pure. */
export function signatureMatches(payload: string, signature: unknown, secret: string): boolean {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/** Converts Razorpay's seconds to a Date (null stays null). Pure. */
export function periodEnd(subscription: GatewaySubscription): Date | null {
  return subscription.current_end ? new Date(subscription.current_end * 1000) : null;
}
