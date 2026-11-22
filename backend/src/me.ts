import { Link } from './models/link';
import { Bio } from './models/bio';
import type { UserRecord } from './models/user';
import { entitlements, monthStartIst } from './plans';

/** Links the user created since the start of this IST calendar month (what the Free limit counts). */
export function linksThisMonth(userId: UserRecord['_id'] | string, now: number): Promise<number> {
  return Link.countDocuments({ owner: userId, createdAt: { $gte: monthStartIst(now) } });
}

/** The `Me` object from the API contract: who the user is, their plan, limits and usage. */
export async function buildMe(user: UserRecord, now = Date.now()) {
  const { plan, ...limits } = entitlements(user.subscription, now);
  const sub = user.subscription;
  const [bio, linkCount] = await Promise.all([Bio.findOne({ owner: user._id }, { handle: 1 }).lean(), linksThisMonth(user._id, now)]);
  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(user.passwordHash),
      hasGoogle: Boolean(user.googleId),
      bioHandle: bio?.handle ?? null,
    },
    plan,
    subscription: sub
      ? {
          status: sub.status,
          interval: sub.interval,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    entitlements: limits,
    usage: { linksThisMonth: linkCount },
  };
}
