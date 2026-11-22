import { Router, type Response } from 'express';
import { isValidObjectId, type Types } from 'mongoose';
import { Link, type LinkRecord } from '../models/link';
import { Click } from '../models/click';
import { parseLinkInput, type LinkInput } from '../linkInput';
import { randomCode } from '../shortCode';
import { humanClickCounts, linkStats } from '../stats';
import type { Entitlements } from '../plans';
import { accountOf, type Account } from '../middleware/account';
import { forbidden, proRequired } from '../httpErrors';
import { linksThisMonth } from '../me';
import { Folder } from '../models/folder';
import { isDuplicateKey } from '../dbErrors';
import { hashPassword } from '../passwords';


const MAX_CODE_ATTEMPTS = 3;

function toLinkSummary(link: LinkRecord) {
  return { id: link._id.toString(), code: link.code, url: link.url, expiresAt: link.expiresAt };
}

function toLinkResponse(link: LinkRecord, clickCount: number) {
  return {
    ...toLinkSummary(link),
    clickCount,
    hasPassword: Boolean(link.passwordHash),
    variants: link.variants.map(({ url, weight }) => ({ url, weight })),
    folderId: link.folderId?.toString() ?? null,
    tags: link.tags,
  };
}

async function clickCountOf(linkId: Types.ObjectId, since: Date | null): Promise<number> {
  return (await humanClickCounts([linkId], since)).get(linkId.toString()) ?? 0;
}

type ProFeature = keyof Entitlements['can'];

/** The Pro feature this input uses, if any. Creating with an empty folder/tag list doesn't count; any change on update does. Pure. */
function proFeatureUsed(input: LinkInput, mode: 'create' | 'update'): ProFeature | null {
  const changes = (value: unknown, nonEmpty: boolean) => (mode === 'create' ? nonEmpty : value !== undefined);
  if (changes(input.variants, Boolean(input.variants?.length))) return 'variants';
  if (changes(input.folderId, Boolean(input.folderId)) || changes(input.tags, Boolean(input.tags?.length))) return 'folders';
  return null;
}

/** Plan and ownership checks shared by create and update. Returns true if it already sent an error response. */
async function rejectInput(res: Response, input: LinkInput, mode: 'create' | 'update', account: Account): Promise<boolean> {
  const feature = proFeatureUsed(input, mode);
  if (feature && !account.limits.can[feature]) {
    proRequired(res, feature === 'variants' ? 'A/B variants' : 'folders and tags');
    return true;
  }
  if (input.folderId && !(await Folder.exists({ _id: input.folderId, owner: account.user._id }))) {
    res.status(400).json({ error: 'Unknown folder' });
    return true;
  }
  return false;
}

/** Escapes a user's search text for use inside a RegExp. Pure. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns null when the requested alias is taken. Random codes are retried on the (rare) collision. */
async function insertLink(owner: string, input: LinkInput): Promise<LinkRecord | null> {
  const fields = {
    owner,
    url: input.url,
    expiresAt: input.expiresAt ?? null,
    folderId: input.folderId ?? null,
    tags: input.tags ?? [],
    passwordHash: input.password ? await hashPassword(input.password) : null,
    variants: input.variants ?? [],
  };
  if (input.alias) {
    try {
      return (await Link.create({ ...fields, code: input.alias })).toObject();
    } catch (err) {
      if (isDuplicateKey(err)) return null;
      throw err;
    }
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return (await Link.create({ ...fields, code: randomCode() })).toObject();
    } catch (err) {
      if (!isDuplicateKey(err) || attempt === MAX_CODE_ATTEMPTS) throw err;
    }
  }
}

function aliasTaken(res: Response) {
  res.status(409).json({ error: 'Alias already taken' });
}

/** Expects requireAuth + loadAccount. */
export function linksRouter() {
  const router = Router();

  // Loads the caller's own link for every /:id route. Another user's link is a 404, so ids can't be probed.
  router.param('id', async (_req, res, next, id: string) => {
    try {
      const link = isValidObjectId(id) ? await Link.findOne({ _id: id, owner: res.locals.userId }).lean() : null;
      if (!link) return void res.status(404).json({ error: 'Link not found' });
      res.locals.link = link;
      next();
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res) => {
    const { user, limits } = accountOf(res);
    if (!user.emailVerified) return forbidden(res, 'Verify your email before creating links', 'EMAIL_NOT_VERIFIED');
    const parsed = parseLinkInput(req.body, 'create', Date.now());
    if ('error' in parsed) return void res.status(400).json({ error: parsed.error });
    if (await rejectInput(res, parsed.input, 'create', accountOf(res))) return;
    if (limits.linkLimitPerMonth !== null && (await linksThisMonth(user._id, Date.now())) >= limits.linkLimitPerMonth) {
      return forbidden(res, `Free plan includes ${limits.linkLimitPerMonth} new links per month`, 'PLAN_LIMIT');
    }

    const link = await insertLink(res.locals.userId, parsed.input);
    if (!link) return aliasTaken(res);
    res.status(201).json(toLinkResponse(link, 0));
  });

  // Filters: ?folder=<id> &tag=<tag> &q=<text in code or destination>
  router.get('/', async (req, res) => {
    const { folder, tag, q } = req.query;
    if (folder !== undefined && !isValidObjectId(folder)) return void res.status(400).json({ error: 'Unknown folder' });
    const search = typeof q === 'string' ? q.trim().slice(0, 100) : '';
    const pattern = new RegExp(escapeRegex(search), 'i');
    const filter = {
      owner: res.locals.userId,
      ...(folder !== undefined ? { folderId: folder } : {}),
      ...(typeof tag === 'string' ? { tags: tag.trim().toLowerCase() } : {}),
      ...(search ? { $or: [{ code: pattern }, { url: pattern }] } : {}),
    };
    const links = await Link.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
    const { since } = accountOf(res);
    const counts = await humanClickCounts(links.map((l) => l._id), since);
    res.json(links.map((l) => toLinkResponse(l, counts.get(l._id.toString()) ?? 0)));
  });

  router.patch('/:id', async (req, res) => {
    const link: LinkRecord = res.locals.link;
    const parsed = parseLinkInput(req.body, 'update', Date.now());
    if ('error' in parsed) return void res.status(400).json({ error: parsed.error });
    if (await rejectInput(res, parsed.input, 'update', accountOf(res))) return;

    const { alias, password, ...rest } = parsed.input;
    const changes = {
      ...rest,
      ...(alias !== undefined ? { code: alias } : {}),
      ...(password !== undefined ? { passwordHash: password === null ? null : await hashPassword(password) } : {}),
    };
    let updated: LinkRecord | null = link;
    if (Object.keys(changes).length > 0) {
      try {
        updated = await Link.findByIdAndUpdate(link._id, { $set: changes }, { new: true, lean: true });
      } catch (err) {
        if (isDuplicateKey(err)) return aliasTaken(res);
        throw err;
      }
    }
    if (!updated) return void res.status(404).json({ error: 'Link not found' }); // deleted meanwhile
    res.json(toLinkResponse(updated, await clickCountOf(updated._id, accountOf(res).since)));
  });

  router.get('/:id/stats', async (req, res) => {
    const link: LinkRecord = res.locals.link;
    const today = new Date().toISOString().slice(0, 10);
    const { since, limits } = accountOf(res);
    const stats = await linkStats(link._id, { includeBots: req.query.bots === 'true', today, since, variants: link.variants, includeGeo: limits.can.geo });
    res.json({ link: toLinkSummary(link), ...stats });
  });

  router.delete('/:id', async (_req, res) => {
    const link: LinkRecord = res.locals.link;
    // Link first, so no new clicks can be recorded for it while its clicks are being deleted.
    await Link.deleteOne({ _id: link._id });
    await Click.deleteMany({ link: link._id });
    res.status(204).end();
  });

  return router;
}
