import { Router, type Request } from 'express';
import { Bio, type BioRecord } from '../models/bio';
import { Link } from '../models/link';
import { accountOf } from '../middleware/account';
import { proRequired } from '../httpErrors';
import { parseBioInput } from '../bioInput';
import { isDuplicateKey } from '../dbErrors';

function toOwnerResponse(bio: BioRecord) {
  return {
    handle: bio.handle,
    title: bio.title,
    description: bio.description,
    theme: bio.theme,
    links: bio.links.map((l) => ({ linkId: l.linkId.toString(), label: l.label })),
  };
}

/** Owner endpoints (expects requireAuth + loadAccount). Reading and deleting work on every plan; publishing/editing needs Pro. */
export function bioRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const bio = await Bio.findOne({ owner: res.locals.userId }).lean();
    res.json(bio ? toOwnerResponse(bio) : null);
  });

  router.put('/', async (req, res) => {
    if (!accountOf(res).limits.can.bio) return proRequired(res, 'link-in-bio');
    const input = parseBioInput(req.body);
    if (typeof input === 'string') return void res.status(400).json({ error: input });

    const ids = input.links.map((l) => l.linkId);
    const owned = await Link.countDocuments({ _id: { $in: ids }, owner: res.locals.userId });
    if (owned !== new Set(ids).size) return void res.status(400).json({ error: 'Every link must be one of your own links' });

    try {
      const bio = await Bio.findOneAndUpdate({ owner: res.locals.userId }, { ...input, owner: res.locals.userId }, { upsert: true, new: true, lean: true, runValidators: true });
      res.json(toOwnerResponse(bio!)); // upsert always returns a document
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      res.status(409).json({ error: 'That handle is taken', code: 'HANDLE_TAKEN' });
    }
  });

  // Lets anyone take their page down, including after a downgrade.
  router.delete('/', async (_req, res) => {
    await Bio.deleteOne({ owner: res.locals.userId });
    res.status(204).end();
  });

  return router;
}

/** Public page data. Clicks go through the short links, so they're tracked like any other click. */
export function publicBioRouter() {
  const router = Router();

  router.get('/:handle', async (req: Request, res) => {
    const bio = await Bio.findOne({ handle: String(req.params.handle).toLowerCase() }).lean();
    if (!bio) return void res.status(404).json({ error: 'Page not found' });

    const links = await Link.find({ _id: { $in: bio.links.map((l) => l.linkId) } }, { code: 1, expiresAt: 1 }).lean();
    const byId = new Map(links.map((l) => [l._id.toString(), l]));
    const base = `${req.protocol}://${req.get('host')}`; // the API host also serves the short links
    const now = Date.now();
    res.json({
      title: bio.title,
      description: bio.description,
      theme: bio.theme,
      links: bio.links.flatMap((item) => {
        const link = byId.get(item.linkId.toString());
        const live = link && !(link.expiresAt && link.expiresAt.getTime() <= now);
        return live ? [{ label: item.label, shortUrl: `${base}/${link.code}` }] : []; // deleted/expired links drop off
      }),
    });
  });

  return router;
}
