import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter, verifyGoogleToken, type VerifyGoogleToken } from './routes/auth';
import { linksRouter } from './routes/links';
import { redirectRouter } from './routes/redirect';
import { createLimiters, defaultRateLimits, type RateLimits } from './middleware/rateLimit';

export interface AppOptions {
  verifyGoogleToken?: VerifyGoogleToken;
  rateLimits?: RateLimits;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  // Render sits behind one proxy; needed so req.ip is the real client IP.
  app.set('trust proxy', 1);
  app.use(cors({ origin: config.frontendOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const limiters = createLimiters(options.rateLimits ?? defaultRateLimits);
  app.use('/api/auth', limiters.login, authRouter(options.verifyGoogleToken ?? verifyGoogleToken));
  app.use('/api/links', linksRouter(limiters.linkWrites));
  // Last, so /:code never shadows /health or /api/*.
  app.use(redirectRouter(limiters.redirects));

  app.use(errorHandler);
  return app;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.code === 11000) {
    // The only unique fields clients can set are link codes/aliases.
    res.status(409).json({ error: 'Alias already taken' });
    return;
  }
  // body-parser errors (e.g. malformed JSON) carry a 4xx status.
  if (typeof err?.status === 'number' && err.status < 500) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
