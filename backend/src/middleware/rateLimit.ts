import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

interface Limit {
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimits {
  readonly login: Limit; // per IP
  readonly linkWrites: Limit; // per user: create / edit / delete
  readonly redirects: Limit; // per IP
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
  };
}
