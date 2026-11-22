const FREE_LINKS_PER_MONTH = 25;
const FREE_HISTORY_DAYS = 30;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India has no daylight saving time

export type Plan = 'free' | 'pro';

interface SubscriptionState {
  readonly status: string;
  readonly currentPeriodEnd?: Date | null;
}

/** Razorpay statuses that grant Pro. A cancelled subscription stays Pro until its paid period ends. */
function grantsPro(subscription: SubscriptionState | null | undefined, now: number): boolean {
  if (!subscription) return false;
  if (subscription.status === 'active' || subscription.status === 'authenticated') return true;
  const periodEnd = subscription.currentPeriodEnd?.getTime() ?? 0;
  return subscription.status === 'cancelled' && periodEnd > now;
}

/** What a user may do right now. Pure: pass the current time in. */
export function entitlements(subscription: SubscriptionState | null | undefined, now: number) {
  const isPro = grantsPro(subscription, now);
  return {
    plan: (isPro ? 'pro' : 'free') as Plan,
    linkLimitPerMonth: isPro ? null : FREE_LINKS_PER_MONTH,
    historyDays: isPro ? null : FREE_HISTORY_DAYS,
    can: { geo: isPro, utmPresets: isPro, folders: isPro, variants: isPro, bio: isPro },
  };
}

export type Entitlements = ReturnType<typeof entitlements>;

/** Oldest click a user may see, or null for unlimited history. Pure. */
export function historySince(limits: Pick<Entitlements, 'historyDays'>, now: number): Date | null {
  return limits.historyDays === null ? null : new Date(now - limits.historyDays * 86_400_000);
}

/** Start of the current calendar month in India (IST), as a UTC Date. Pure. */
export function monthStartIst(now: number): Date {
  const ist = new Date(now + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}
