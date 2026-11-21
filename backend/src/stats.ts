import type { PipelineStage, Types } from 'mongoose';
import { Click } from './models/click';

interface Bucket {
  _id: string;
  count: number;
}

const DAY_MS = 86_400_000;

function breakdown(field: string): PipelineStage.FacetPipelineStage[] {
  return [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }];
}

/** Every UTC day from the first click to today, with zeros for days without clicks. */
function fillDays(buckets: Bucket[]) {
  if (buckets.length === 0) return [];
  const counts = new Map(buckets.map((b) => [b._id, b.count]));
  const days = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let t = Date.parse(buckets[0]._id); ; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({ date, count: counts.get(date) ?? 0 });
    if (date >= today) break;
  }
  return days;
}

export async function linkStats(linkId: Types.ObjectId, includeBots: boolean) {
  const match = includeBots ? { link: linkId } : { link: linkId, isBot: false };

  const [[facets], botClicks] = await Promise.all([
    Click.aggregate([
      { $match: match },
      {
        $facet: {
          total: [{ $count: 'n' }],
          uniques: [{ $group: { _id: '$visitorHash' } }, { $count: 'n' }],
          perDay: [
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          referrers: breakdown('referrer'),
          browsers: breakdown('browser'),
          os: breakdown('os'),
          devices: breakdown('deviceType'),
        },
      },
    ]),
    Click.countDocuments({ link: linkId, isBot: true }),
  ]);

  const list = (buckets: Bucket[]) => buckets.map((b) => ({ value: b._id, count: b.count }));

  return {
    includeBots,
    total: facets.total[0]?.n ?? 0,
    uniqueVisitors: facets.uniques[0]?.n ?? 0,
    botClicks,
    clicksPerDay: fillDays(facets.perDay),
    referrers: list(facets.referrers).map((r) => ({ ...r, value: r.value || 'direct' })),
    browsers: list(facets.browsers),
    os: list(facets.os),
    devices: list(facets.devices),
  };
}
