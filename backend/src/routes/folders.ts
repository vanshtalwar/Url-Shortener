import { Router } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { isDuplicateKey } from '../dbErrors';
import { Folder } from '../models/folder';
import { Link } from '../models/link';
import { accountOf } from '../middleware/account';
import { proRequired } from '../httpErrors';

const MAX_NAME_LENGTH = 40;

function nameError(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.trim().length <= MAX_NAME_LENGTH
    ? null
    : `Folder name must be 1-${MAX_NAME_LENGTH} characters`;
}

/**
 * Expects requireAuth + loadAccount. Listing and deleting work on every plan (so folders made while on Pro stay
 * visible and can be cleaned up after a downgrade); creating and renaming need Pro.
 */
export function foldersRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const owner = res.locals.userId;
    const [folders, counts] = await Promise.all([
      Folder.find({ owner }).sort({ name: 1 }).lean(),
      Link.aggregate<{ _id: unknown; n: number }>([
        { $match: { owner: new Types.ObjectId(owner), folderId: { $ne: null } } },
        { $group: { _id: '$folderId', n: { $sum: 1 } } },
      ]),
    ]);
    const byFolder = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json(folders.map((f) => ({ id: f._id.toString(), name: f.name, linkCount: byFolder.get(f._id.toString()) ?? 0 })));
  });

  router.post('/', async (req, res) => {
    if (!accountOf(res).limits.can.folders) return proRequired(res, 'folders');
    const error = nameError(req.body?.name);
    if (error) return void res.status(400).json({ error });
    try {
      const folder = await Folder.create({ owner: res.locals.userId, name: req.body.name.trim() });
      res.status(201).json({ id: folder.id, name: folder.name, linkCount: 0 });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      res.status(409).json({ error: 'You already have a folder with that name' });
    }
  });

  router.patch('/:id', async (req, res) => {
    if (!accountOf(res).limits.can.folders) return proRequired(res, 'folders');
    const error = nameError(req.body?.name);
    if (error) return void res.status(400).json({ error });
    try {
      const folder = isValidObjectId(req.params.id)
        ? await Folder.findOneAndUpdate({ _id: req.params.id, owner: res.locals.userId }, { name: req.body.name.trim() }, { new: true, lean: true })
        : null;
      if (!folder) return void res.status(404).json({ error: 'Folder not found' });
      res.json({ id: folder._id.toString(), name: folder.name, linkCount: await Link.countDocuments({ folderId: folder._id }) });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      res.status(409).json({ error: 'You already have a folder with that name' });
    }
  });

  // Links in the folder are kept; they just leave it.
  router.delete('/:id', async (req, res) => {
    const folder = isValidObjectId(req.params.id) ? await Folder.findOneAndDelete({ _id: req.params.id, owner: res.locals.userId }).lean() : null;
    if (!folder) return void res.status(404).json({ error: 'Folder not found' });
    await Link.updateMany({ folderId: folder._id }, { folderId: null });
    res.status(204).end();
  });

  return router;
}
