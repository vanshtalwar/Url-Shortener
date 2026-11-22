import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

interface Limit {
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimits {
  readonly login: Limit; // per IP
  readonly linkWrites: Limit; // per user: create / edit / delete
  readonly redirects: Limit; // per IP
  readonly unlocks: Limit; // password guesses per IP per protected link
}

const message = { error: 'Too many requests, please try again later' };

/** Fails loudly if mounted before requireAuth, instead of silently putting every user in one bucket. */
function userKey(_req: Request, res: Response): string {
  const userId: unknown = res.locals.userId;
  if (typeof userId !== 'string') throw new Error('linkWrites rate limiter must run after requireAuth');
  return userId;
}

/** In-memory stores: fine for a single instance (Render free tier). */
export function createLimiters(limits: RateLimits) {
  return {
    login: rateLimit({ ...limits.login, message }),
    linkWrites: rateLimit({ ...limits.linkWrites, message, keyGenerator: userKey, skip: (req) => req.method === 'GET' }),
    redirects: rateLimit({ ...limits.redirects, message }),
    unlocks: rateLimit({
      ...limits.unlocks,
      message: 'Too many password attempts. Try again later.',
      keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${req.params.code}`,
    }),
  };
}
