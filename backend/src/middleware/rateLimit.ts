import { rateLimit } from 'express-rate-limit';

export interface Limit {
  limit: number;
  windowMs: number;
}

export interface RateLimits {
  login: Limit; // per IP
  linkWrites: Limit; // per user: create / edit / delete
  redirects: Limit; // per IP
}

const MINUTE = 60_000;

export const defaultRateLimits: RateLimits = {
  login: { limit: 10, windowMs: 15 * MINUTE },
  linkWrites: { limit: 30, windowMs: 15 * MINUTE },
  redirects: { limit: 120, windowMs: MINUTE },
};

const message = { error: 'Too many requests, please try again later' };

/** In-memory stores: fine for a single instance (Render free tier). */
export function createLimiters(limits: RateLimits) {
  return {
    login: rateLimit({ ...limits.login, message }),
    // Must run after requireAuth so res.locals.userId is set.
    linkWrites: rateLimit({ ...limits.linkWrites, message, keyGenerator: (_req, res) => res.locals.userId }),
    redirects: rateLimit({ ...limits.redirects, message }),
  };
}
