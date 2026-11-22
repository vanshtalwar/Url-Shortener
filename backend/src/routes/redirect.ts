import { Router, type RequestHandler } from 'express';
import { config } from '../config';
import { Link } from '../models/link';
import { Click } from '../models/click';
import { describeVisit } from '../visit';

export function redirectRouter(redirectLimiter: RequestHandler) {
  const router = Router();

  // Express also routes HEAD here.
  router.get('/:code', redirectLimiter, async (req, res) => {
    const link = await Link.findOne({ code: req.params.code }, { url: 1, expiresAt: 1 }).lean();
    if (!link) return void res.status(404).send('Short link not found');
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      return void res.status(410).send('This short link has expired');
    }

    // HEAD requests (link checkers, unfurlers) get the redirect but aren't clicks.
    if (req.method === 'GET') {
      const visit = describeVisit(
        { userAgent: req.get('user-agent') ?? '', referer: req.get('referer'), ip: req.ip },
        config.visitorHashSalt,
      );
      await Click.create({ link: link._id, ...visit });
    }
    res.redirect(302, link.url);
  });

  return router;
}
