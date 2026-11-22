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

/**
 * Every UTC day (YYYY-MM-DD) from `start` (default: the first counted day) to `today`, with 0 for days without
 * clicks. With no start and no clicks, returns []. Pure.
 */
export function fillDays(days: GroupCount[], today: string, start?: string): { date: string; count: number }[] {
  const first = start ?? days[0]?._id;
  if (!first) return [];
  const counts = new Map(days.map((d) => [d._id, d.count]));
  const filled = [];
  for (let t = Date.parse(first); ; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    filled.push({ date, count: counts.get(date) ?? 0 });
    if (date >= today) break;
  }
  return filled;
}

/**
 * One aggregation: bot count over all clicks, everything else over human clicks (or all, with includeBots).
 * `since` hides older clicks (Free plan); `historyLimited` says whether any were hidden.
 */
interface StatsOptions {
  includeBots: boolean;
  today: string; // YYYY-MM-DD (UTC)
  since: Date | null; // hide older clicks (Free plan)
  variants: readonly { url: string }[]; // the link's current A/B destinations
  includeGeo: boolean; // country/city breakdowns (Pro)
}

export async function linkStats(linkId: Types.ObjectId, { includeBots, today, since, variants, includeGeo }: StatsOptions) {
  const visible: PipelineStage.FacetPipelineStage[] = includeBots ? [] : [{ $match: { isBot: false } }];

  const [[facets], hiddenClick] = await Promise.all([
    Click.aggregate([
      { $match: { link: linkId, ...(since ? { clickedAt: { $gte: since } } : {}) } },
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
          variantClicks: [...visible, ...countBy('variantUrl')],
          countries: [...visible, ...countBy('country')],
          // City names repeat across countries, so group on "City, CC".
          cities: [
            ...visible,
            { $group: { _id: { $cond: [{ $eq: ['$city', 'Unknown'] }, 'Unknown', { $concat: ['$city', ', ', '$country'] }] }, count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
        },
      },
    ]),
    since ? Click.exists({ link: linkId, clickedAt: { $lt: since } }) : null,
  ]);

  return {
    total: facets.total[0]?.n ?? 0,
    uniqueVisitors: facets.uniques[0]?.n ?? 0,
    botClicks: facets.botClicks[0]?.n ?? 0,
    historyLimited: hiddenClick !== null,
    clicksPerDay: fillDays(facets.perDay, today),
    referrers: toCountItems(facets.referrers).map((r) => ({ ...r, value: r.value || 'direct' })),
    browsers: toCountItems(facets.browsers),
    operatingSystems: toCountItems(facets.operatingSystems),
    devices: toCountItems(facets.devices),
    variants: variantClicks(variants, facets.variantClicks),
    countries: includeGeo ? toCountItems(facets.countries) : null,
    cities: includeGeo ? toCountItems(facets.cities) : null,
  };
}

/** Clicks per current A/B destination (null for single-destination links). Pure. */
function variantClicks(variants: readonly { url: string }[], groups: GroupCount[]) {
  if (variants.length === 0) return null;
  const counts = new Map(groups.map((g) => [g._id, g.count]));
  return variants.map((v) => ({ url: v.url, clicks: counts.get(v.url) ?? 0 }));
}

/** Human (non-bot) clicks per link id, counted from the clicks themselves so they can never drift. */
export async function humanClickCounts(linkIds: Types.ObjectId[], since: Date | null): Promise<Map<string, number>> {
  const groups: { _id: Types.ObjectId; count: number }[] = await Click.aggregate([
    { $match: { link: { $in: linkIds }, isBot: false, ...(since ? { clickedAt: { $gte: since } } : {}) } },
    { $group: { _id: '$link', count: { $sum: 1 } } },
  ]);
  return new Map(groups.map((g) => [g._id.toString(), g.count]));
}
