import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config';
import { requireAuth } from './middleware/auth';
import { createLimiters, type RateLimits } from './middleware/rateLimit';
import { authRouter, verifyGoogleToken, type VerifyGoogleToken } from './routes/auth';
import { linksRouter } from './routes/links';
import { redirectRouter } from './routes/redirect';

export interface AppOptions {
  verifyGoogleToken?: VerifyGoogleToken;
  rateLimits?: RateLimits;
  trustProxyHops?: number;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxyHops ?? config.trustProxyHops);
  app.use(cors({ origin: config.frontendOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const limiters = createLimiters(options.rateLimits ?? config.rateLimits);
  app.use('/api/auth', limiters.login, authRouter(options.verifyGoogleToken ?? verifyGoogleToken));
  app.use('/api/links', requireAuth, limiters.linkWrites, linksRouter());
  // Last, so /:code never shadows /health or /api/*.
  app.use(redirectRouter(limiters.redirects));

  app.use(errorHandler);
  return app;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // body-parser errors (e.g. malformed JSON) carry a 4xx status.
  if (typeof err?.status === 'number' && err.status < 500) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
