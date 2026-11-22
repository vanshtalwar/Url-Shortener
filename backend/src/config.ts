import 'dotenv/config';
import { resolve } from 'node:path';
import type { RateLimits } from './middleware/rateLimit';

type Env = Record<string, string | undefined>;

const MINUTE = 60_000;

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function integer(env: Env, name: string, fallback: number, min: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) throw new Error(`${name} must be an integer >= ${min}`);
  return value;
}

/** Reads and validates every setting up front, so a bad deploy fails at startup, not on first use. */
export function loadConfig(env: Env) {
  const rateLimits: RateLimits = {
    login: { limit: integer(env, 'LOGIN_RATE_LIMIT', 10, 1), windowMs: 15 * MINUTE },
    linkWrites: { limit: integer(env, 'LINK_WRITE_RATE_LIMIT', 30, 1), windowMs: 15 * MINUTE },
    redirects: { limit: integer(env, 'REDIRECT_RATE_LIMIT', 120, 1), windowMs: MINUTE },
    unlocks: { limit: integer(env, 'UNLOCK_RATE_LIMIT', 10, 1), windowMs: 15 * MINUTE },
  };
  return Object.freeze({
    port: integer(env, 'PORT', 3000, 1),
    frontendOrigin: required(env, 'FRONTEND_ORIGIN'),
    mongodbUri: required(env, 'MONGODB_URI'),
    jwtSecret: required(env, 'JWT_SECRET'),
    googleClientId: required(env, 'GOOGLE_CLIENT_ID'),
    visitorHashSalt: required(env, 'VISITOR_HASH_SALT'),
    // Gmail address + app password used to send verification and password-reset emails.
    smtpUser: required(env, 'SMTP_USER'),
    smtpPass: required(env, 'SMTP_PASS'),
    razorpay: Object.freeze({
      keyId: required(env, 'RAZORPAY_KEY_ID'),
      keySecret: required(env, 'RAZORPAY_KEY_SECRET'),
      webhookSecret: required(env, 'RAZORPAY_WEBHOOK_SECRET'),
      planMonthly: required(env, 'RAZORPAY_PLAN_MONTHLY'), // ₹199 / month
      planYearly: required(env, 'RAZORPAY_PLAN_YEARLY'), // ₹1,990 / year
    }),
    // Number of reverse proxies in front of the app; decides which X-Forwarded-For entry is the client IP.
    trustProxyHops: integer(env, 'TRUST_PROXY_HOPS', 1, 0),
    // MaxMind GeoLite2 City file, downloaded at build time by scripts/download-geoip.sh.
    geoipDbPath: resolve(env.GEOIP_DB_PATH || 'data/GeoLite2-City.mmdb'),
    rateLimits: Object.freeze(rateLimits),
  });
}

type Config = ReturnType<typeof loadConfig>;

export const config: Config = loadConfig(process.env);
