import type { RequestHandler, Response } from 'express';
import { User, type UserRecord } from '../models/user';
import { entitlements, historySince, type Entitlements } from '../plans';

/** The signed-in user's account, loaded once per request by `loadAccount`. */
export interface Account {
  user: UserRecord;
  limits: Entitlements;
  since: Date | null; // oldest click this plan may see
}

/** Runs after requireAuth: loads the user and their plan; 401 if the account no longer exists. */
export const loadAccount: RequestHandler = async (_req, res, next) => {
  try {
    const user = await User.findById(res.locals.userId).lean();
    if (!user) return void res.status(401).json({ error: 'Not authenticated' });
    const now = Date.now();
    const limits = entitlements(user.subscription, now);
    res.locals.account = { user, limits, since: historySince(limits, now) } satisfies Account;
    next();
  } catch (err) {
    next(err);
  }
};

export function accountOf(res: Response): Account {
  return res.locals.account;
}
