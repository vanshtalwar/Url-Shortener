import { Router, type Response } from 'express';
import { isValidObjectId, type Types } from 'mongoose';
import { Link, type LinkRecord } from '../models/link';
import { Click } from '../models/click';
import { parseLinkInput, type LinkInput } from '../linkInput';
import { randomCode } from '../shortCode';
import { humanClickCounts, linkStats } from '../stats';

const MAX_CODE_ATTEMPTS = 3;

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 11000;
}

function toLinkSummary(link: LinkRecord) {
  return { id: link._id.toString(), code: link.code, url: link.url, expiresAt: link.expiresAt };
}

function toLinkResponse(link: LinkRecord, clickCount: number) {
  return { ...toLinkSummary(link), clickCount };
}

async function clickCountOf(linkId: Types.ObjectId): Promise<number> {
  return (await humanClickCounts([linkId])).get(linkId.toString()) ?? 0;
}

/** Returns null when the requested alias is taken. Random codes are retried on the (rare) collision. */
async function insertLink(owner: string, input: LinkInput): Promise<LinkRecord | null> {
  const fields = { owner, url: input.url, expiresAt: input.expiresAt ?? null };
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

/** Expects requireAuth to have run (res.locals.userId). */
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
    const parsed = parseLinkInput(req.body, 'create', Date.now());
    if ('error' in parsed) return void res.status(400).json({ error: parsed.error });

    const link = await insertLink(res.locals.userId, parsed.input);
    if (!link) return aliasTaken(res);
    res.status(201).json(toLinkResponse(link, 0));
  });

  router.get('/', async (_req, res) => {
    const links = await Link.find({ owner: res.locals.userId }).sort({ createdAt: -1, _id: -1 }).lean();
    const counts = await humanClickCounts(links.map((l) => l._id));
    res.json(links.map((l) => toLinkResponse(l, counts.get(l._id.toString()) ?? 0)));
  });

  router.patch('/:id', async (req, res) => {
    const link: LinkRecord = res.locals.link;
    const parsed = parseLinkInput(req.body, 'update', Date.now());
    if ('error' in parsed) return void res.status(400).json({ error: parsed.error });

    const { alias, ...rest } = parsed.input;
    const changes = { ...rest, ...(alias !== undefined ? { code: alias } : {}) };
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
    res.json(toLinkResponse(updated, await clickCountOf(updated._id)));
  });

  router.get('/:id/stats', async (req, res) => {
    const link: LinkRecord = res.locals.link;
    const today = new Date().toISOString().slice(0, 10);
    res.json({ link: toLinkSummary(link), ...(await linkStats(link._id, req.query.bots === 'true', today)) });
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
