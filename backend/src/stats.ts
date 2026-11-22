import type { PipelineStage, Types } from 'mongoose';
import { Click } from './models/click';

/** Shape of a MongoDB `$group` result: `_id` is the grouped value. */
interface GroupCount {
  _id: string;
  count: number;
}

interface CountItem {
  value: string;
  count: number;
}

const DAY_MS = 86_400_000;

function countBy(field: string): PipelineStage.FacetPipelineStage[] {
  return [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }];
}

function toCountItems(groups: GroupCount[]): CountItem[] {
  return groups.map((g) => ({ value: g._id, count: g.count }));
}

/** Every UTC day from the first counted day to `today` (YYYY-MM-DD), with 0 for days without clicks. Pure. */
export function fillDays(days: GroupCount[], today: string): { date: string; count: number }[] {
  if (days.length === 0) return [];
  const counts = new Map(days.map((d) => [d._id, d.count]));
  const filled = [];
  for (let t = Date.parse(days[0]._id); ; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    filled.push({ date, count: counts.get(date) ?? 0 });
    if (date >= today) break;
  }
  return filled;
}

/** One aggregation: bot count over all clicks, everything else over human clicks (or all, with includeBots). */
export async function linkStats(linkId: Types.ObjectId, includeBots: boolean, today: string) {
  const visible: PipelineStage.FacetPipelineStage[] = includeBots ? [] : [{ $match: { isBot: false } }];

  const [facets] = await Click.aggregate([
    { $match: { link: linkId } },
    {
      $facet: {
        botClicks: [{ $match: { isBot: true } }, { $count: 'n' }],
        total: [...visible, { $count: 'n' }],
        uniques: [...visible, { $group: { _id: '$visitorHash' } }, { $count: 'n' }],
        perDay: [
          ...visible,
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        referrers: [...visible, ...countBy('referrer')],
        browsers: [...visible, ...countBy('browser')],
        operatingSystems: [...visible, ...countBy('os')],
        devices: [...visible, ...countBy('deviceType')],
      },
    },
  ]);

  return {
    total: facets.total[0]?.n ?? 0,
    uniqueVisitors: facets.uniques[0]?.n ?? 0,
    botClicks: facets.botClicks[0]?.n ?? 0,
    clicksPerDay: fillDays(facets.perDay, today),
    referrers: toCountItems(facets.referrers).map((r) => ({ ...r, value: r.value || 'direct' })),
    browsers: toCountItems(facets.browsers),
    operatingSystems: toCountItems(facets.operatingSystems),
    devices: toCountItems(facets.devices),
  };
}

/** Human (non-bot) clicks per link id, counted from the clicks themselves so they can never drift. */
export async function humanClickCounts(linkIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const groups: { _id: Types.ObjectId; count: number }[] = await Click.aggregate([
    { $match: { link: { $in: linkIds }, isBot: false } },
    { $group: { _id: '$link', count: { $sum: 1 } } },
  ]);
  return new Map(groups.map((g) => [g._id.toString(), g.count]));
}
