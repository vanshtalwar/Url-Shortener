import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { UtmPreset } from '../models/utmPreset';
import { accountOf } from '../middleware/account';
import { proRequired } from '../httpErrors';

const MAX_LENGTH = 100;
const REQUIRED = ['name', 'source', 'medium', 'campaign'] as const;
const OPTIONAL = ['term', 'content'] as const;
type Field = (typeof REQUIRED)[number] | (typeof OPTIONAL)[number];

/** Trimmed preset fields, or an error message. Pure. */
function parsePreset(body: unknown): Record<Field, string> | string {
  const input = (body ?? {}) as Record<string, unknown>;
  const fields = {} as Record<Field, string>;
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    const raw = input[key] ?? '';
    if (typeof raw !== 'string') return `${key} must be text`;
    const value = raw.trim();
    if (!value && (REQUIRED as readonly string[]).includes(key)) return `${key} is required`;
    if (value.length > MAX_LENGTH) return `${key} must be at most ${MAX_LENGTH} characters`;
    fields[key] = value;
  }
  return fields;
}

function toResponse(p: { _id: { toString(): string } } & Record<Field, string>) {
  return { id: p._id.toString(), name: p.name, source: p.source, medium: p.medium, campaign: p.campaign, term: p.term, content: p.content };
}

/** Expects requireAuth + loadAccount. Listing and deleting work on every plan; saving new presets needs Pro. */
export function utmPresetsRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const presets = await UtmPreset.find({ owner: res.locals.userId }).sort({ name: 1 }).lean();
    res.json(presets.map(toResponse));
  });

  router.post('/', async (req, res) => {
    if (!accountOf(res).limits.can.utmPresets) return proRequired(res, 'UTM presets');
    const fields = parsePreset(req.body);
    if (typeof fields === 'string') return void res.status(400).json({ error: fields });
    const preset = await UtmPreset.create({ owner: res.locals.userId, ...fields });
    res.status(201).json(toResponse(preset.toObject()));
  });

  router.delete('/:id', async (req, res) => {
    const deleted = isValidObjectId(req.params.id) && (await UtmPreset.deleteOne({ _id: req.params.id, owner: res.locals.userId })).deletedCount;
    if (!deleted) return void res.status(404).json({ error: 'Preset not found' });
    res.status(204).end();
  });

  return router;
}
