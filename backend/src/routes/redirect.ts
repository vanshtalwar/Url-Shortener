import express, { Router, type Request, type RequestHandler, type Response } from 'express';
import { config } from '../config';
import { Link, type LinkRecord } from '../models/link';
import { Click } from '../models/click';
import { describeVisit } from '../visit';
import { checkPassword } from '../passwords';
import { passwordPage } from '../passwordPage';
import { pickVariant } from '../variants';
import type { GeoLookup } from '../geo';

type RedirectTarget = Pick<LinkRecord, '_id' | 'url' | 'expiresAt' | 'passwordHash' | 'variants'>;

/** The `:code` route parameter (always a single string for these routes). */
const codeOf = (req: Request): string => String(req.params.code);

/** Finds a live link by code, or sends 404/410 and returns null. */
async function findLiveLink(req: Request, res: Response): Promise<RedirectTarget | null> {
  const link = await Link.findOne({ code: codeOf(req) }, { url: 1, expiresAt: 1, passwordHash: 1, variants: 1 }).lean();
  if (!link) {
    res.status(404).send('Short link not found');
    return null;
  }
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    res.status(410).send('This short link has expired');
    return null;
  }
  return link;
}

/** Picks the destination (A/B split if any), records the click (not for HEAD: link checkers), then redirects. */
async function recordAndRedirect(req: Request, res: Response, link: RedirectTarget, random: () => number, geo: GeoLookup) {
  const variantUrl = link.variants.length > 0 ? pickVariant(link.variants, random()).url : null;
  if (req.method !== 'HEAD') {
    const visit = describeVisit({ userAgent: req.get('user-agent') ?? '', referer: req.get('referer'), ip: req.ip }, config.visitorHashSalt);
    await Click.create({ link: link._id, ...visit, variantUrl, ...(await geo(req.ip)) });
  }
  res.redirect(302, variantUrl ?? link.url);
}

/** `random` decides A/B splits and `geo` locates visitors; both injectable for tests. */
export function redirectRouter(redirectLimiter: RequestHandler, unlockLimiter: RequestHandler, random: () => number, geo: GeoLookup) {
  const router = Router();

  // Express also routes HEAD here.
  router.get('/:code', redirectLimiter, async (req, res) => {
    const link = await findLiveLink(req, res);
    if (!link) return;
    if (link.passwordHash) return void res.status(200).type('html').send(passwordPage(codeOf(req)));
    await recordAndRedirect(req, res, link, random, geo);
  });

  router.post('/:code/unlock', redirectLimiter, unlockLimiter, express.urlencoded({ extended: false, limit: '2kb' }), async (req, res) => {
    const link = await findLiveLink(req, res);
    if (!link) return;
    const password: unknown = req.body?.password;
    const ok = typeof password === 'string' && Boolean(link.passwordHash) && (await checkPassword(password, link.passwordHash));
    if (!ok) return void res.status(401).type('html').send(passwordPage(codeOf(req), 'Incorrect password. Try again.'));
    await recordAndRedirect(req, res, link, random, geo);
  });

  return router;
}
