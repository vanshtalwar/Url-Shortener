import { createHash } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { isbot } from 'isbot';
import UAParser from 'ua-parser-js';
import { config } from '../config';
import { Link } from '../models/link';
import { Click } from '../models/click';

function referrerHost(referrer: string | undefined): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname;
  } catch {
    return '';
  }
}

export function redirectRouter(limiter: RequestHandler) {
  const router = Router();

  router.get('/:code', limiter, async (req, res) => {
    const link = await Link.findOne({ code: req.params.code });
    if (!link) return void res.status(404).send('Short link not found');
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      return void res.status(410).send('This short link has expired');
    }

    const userAgent = req.get('user-agent') ?? '';
    const ua = new UAParser(userAgent).getResult();
    const isBot = isbot(userAgent);

    await Click.create({
      link: link._id,
      referrer: referrerHost(req.get('referer')),
      browser: ua.browser.name ?? 'Unknown',
      os: ua.os.name ?? 'Unknown',
      // ua-parser leaves device.type empty for desktops.
      deviceType: ua.device.type ?? 'desktop',
      isBot,
      visitorHash: createHash('sha256').update(`${config.visitorHashSalt()}|${req.ip}|${userAgent}`).digest('hex'),
    });
    if (!isBot) await Link.updateOne({ _id: link._id }, { $inc: { clickCount: 1 } });

    res.redirect(302, link.url);
  });

  return router;
}
