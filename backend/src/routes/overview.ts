import { Router } from 'express';
import { Types } from 'mongoose';
import { Link } from '../models/link';
import { Click } from '../models/click';
import { accountOf } from '../middleware/account';
import { fillDays } from '../stats';

const RANGES = [7, 30, 90] as const;
const TOP_LINKS = 5;
const DAY_MS = 86_400_000;

/** Expects requireAuth + loadAccount. Human clicks across all of the user's links. */
export function overviewRouter() {
  const router = Router();

  // ?days=7|30|90 (default 30). Free history is capped, so the response says which window was used.
  router.get('/overview', async (req, res) => {
    const requested = Number(req.query.days ?? 30);
    if (!(RANGES as readonly number[]).includes(requested)) return void res.status(400).json({ error: 'days must be 7, 30 or 90' });
    const { limits } = accountOf(res);
    const days = limits.historyDays === null ? requested : Math.min(requested, limits.historyDays);

    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const startDay = new Date(now - (days - 1) * DAY_MS).toISOString().slice(0, 10);
    const links = await Link.find({ owner: new Types.ObjectId(res.locals.userId) }, { code: 1 }).lean();
    const codes = new Map(links.map((l) => [l._id.toString(), l.code]));

    const [facets] = await Click.aggregate([
      { $match: { link: { $in: links.map((l) => l._id) }, isBot: false, clickedAt: { $gte: new Date(startDay) } } },
      {
        $facet: {
          clicks: [{ $count: 'n' }],
          uniques: [{ $group: { _id: '$visitorHash' } }, { $count: 'n' }],
          perDay: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } }, count: { $sum: 1 } } }],
          top: [{ $group: { _id: '$link', clicks: { $sum: 1 } } }, { $sort: { clicks: -1, _id: 1 } }, { $limit: TOP_LINKS }],
        },
      },
    ]);

    res.json({
      days,
      totals: { clicks: facets.clicks[0]?.n ?? 0, uniques: facets.uniques[0]?.n ?? 0, links: links.length },
      clicksPerDay: fillDays(facets.perDay, today, startDay),
      topLinks: facets.top.map((t: { _id: Types.ObjectId; clicks: number }) => ({
        id: t._id.toString(),
        code: codes.get(t._id.toString()),
        clicks: t.clicks,
      })),
    });
  });

  return router;
}
