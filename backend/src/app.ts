import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config';
import { requireAuth } from './middleware/auth';
import { loadAccount } from './middleware/account';
import { createLimiters, type RateLimits } from './middleware/rateLimit';
import { authRouter, verifyGoogleToken, type VerifyGoogleToken } from './routes/auth';
import { linksRouter } from './routes/links';
import { meRouter } from './routes/me';
import { foldersRouter } from './routes/folders';
import { utmPresetsRouter } from './routes/utmPresets';
import { bioRouter, publicBioRouter } from './routes/bio';
import { overviewRouter } from './routes/overview';
import { redirectRouter } from './routes/redirect';
import { createSmtpMailer, type Mailer } from './mailer';
import { billingRouter, billingWebhook } from './routes/billing';
import { createRazorpayGateway, type BillingGateway } from './billing';
import { createGeoLookup, type GeoLookup } from './geo';

export interface AppOptions {
  verifyGoogleToken?: VerifyGoogleToken;
  rateLimits?: RateLimits;
  trustProxyHops?: number;
  mailer?: Mailer;
  billing?: BillingGateway;
  random?: () => number; // A/B split source
  geo?: GeoLookup;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', options.trustProxyHops ?? config.trustProxyHops);
  app.use(cors({ origin: config.frontendOrigin }));
  // Signature is computed over the exact bytes, so this must see the raw body (before express.json).
  app.post('/api/billing/webhook', express.raw({ type: '*/*', limit: '1mb' }), billingWebhook);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const limiters = createLimiters(options.rateLimits ?? config.rateLimits);
  const mailer = options.mailer ?? createSmtpMailer(config.smtpUser, config.smtpPass);
  app.use('/api/auth', limiters.login, authRouter(options.verifyGoogleToken ?? verifyGoogleToken, mailer));
  app.use('/api/me', requireAuth, loadAccount, meRouter());
  const billing = options.billing ?? createRazorpayGateway(config.razorpay.keyId, config.razorpay.keySecret);
  app.use('/api/billing', requireAuth, loadAccount, billingRouter(billing));
  app.use('/api/links', requireAuth, loadAccount, limiters.linkWrites, linksRouter());
  app.use('/api/folders', requireAuth, loadAccount, limiters.linkWrites, foldersRouter());
  app.use('/api/utm-presets', requireAuth, loadAccount, limiters.linkWrites, utmPresetsRouter());
  app.use('/api/bio', requireAuth, loadAccount, limiters.linkWrites, bioRouter());
  app.use('/api/stats', requireAuth, loadAccount, overviewRouter());
  app.use('/api/public/bio', limiters.redirects, publicBioRouter());
  // Last, so /:code never shadows /health or /api/*.
  const geo = options.geo ?? createGeoLookup(config.geoipDbPath);
  app.use(redirectRouter(limiters.redirects, limiters.unlocks, options.random ?? Math.random, geo));

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
