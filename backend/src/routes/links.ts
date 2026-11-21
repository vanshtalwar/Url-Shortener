import { randomInt } from 'node:crypto';
import { Router, type RequestHandler, type Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Link, serializeLink } from '../models/link';
import { Click } from '../models/click';
import { linkStats } from '../stats';
import { requireAuth } from '../middleware/auth';

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;
// Express matches routes case-insensitively, so these are compared lowercased.
const RESERVED_ALIASES = ['api', 'health'];

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 7; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return code;
}

/** Each validator returns an error message, or null when the value is fine. */
function validateUrl(value: unknown): string | null {
  if (typeof value !== 'string') return 'url is required';
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? null : 'url must start with http:// or https://';
  } catch {
    return 'url is not a valid URL';
  }
}

function validateAlias(value: unknown): string | null {
  if (typeof value !== 'string' || !ALIAS_PATTERN.test(value)) {
    return 'alias must be 3-30 characters: letters, digits, - or _';
  }
  return RESERVED_ALIASES.includes(value.toLowerCase()) ? 'alias is reserved' : null;
}

function validateExpiry(value: unknown): string | null {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return 'expiresAt must be an ISO date string';
  return time > Date.now() ? null : 'expiresAt must be in the future';
}

function badRequest(res: Response, error: string) {
  res.status(400).json({ error });
}

export function linksRouter(writeLimiter: RequestHandler) {
  const router = Router();
  router.use(requireAuth);
  // create / edit / delete are rate limited per user; reads are not.
  router.use((req, res, next) => (req.method === 'GET' ? next() : writeLimiter(req, res, next)));

  router.post('/', async (req, res) => {
    const { url, alias, expiresAt } = req.body ?? {};
    const error =
      validateUrl(url) ??
      (alias !== undefined && alias !== '' ? validateAlias(alias) : null) ??
      (expiresAt !== undefined && expiresAt !== null ? validateExpiry(expiresAt) : null);
    if (error) return badRequest(res, error);

    const link = await Link.create({
      owner: res.locals.userId,
      code: alias || randomCode(),
      url,
      expiresAt: expiresAt ?? null,
    });
    res.status(201).json(serializeLink(link));
  });

  router.get('/', async (_req, res) => {
    const links = await Link.find({ owner: res.locals.userId }).sort({ createdAt: -1, _id: -1 }); // _id breaks same-millisecond ties
    res.json(links.map(serializeLink));
  });

  router.patch('/:id', async (req, res) => {
    const link = await findOwnedLink(req.params.id, res.locals.userId);
    if (!link) return void res.status(404).json({ error: 'Link not found' });

    const { url, alias, expiresAt } = req.body ?? {};
    const error =
      (url !== undefined ? validateUrl(url) : null) ??
      (alias !== undefined ? validateAlias(alias) : null) ??
      (expiresAt !== undefined && expiresAt !== null ? validateExpiry(expiresAt) : null);
    if (error) return badRequest(res, error);

    if (url !== undefined) link.url = url;
    if (alias !== undefined) link.code = alias;
    if (expiresAt !== undefined) link.expiresAt = expiresAt;
    await link.save();
    res.json(serializeLink(link));
  });

  router.get('/:id/stats', async (req, res) => {
    const link = await findOwnedLink(req.params.id, res.locals.userId);
    if (!link) return void res.status(404).json({ error: 'Link not found' });
    res.json({ link: serializeLink(link), ...(await linkStats(link._id, req.query.bots === 'true')) });
  });

  router.delete('/:id', async (req, res) => {
    const link = await findOwnedLink(req.params.id, res.locals.userId);
    if (!link) return void res.status(404).json({ error: 'Link not found' });
    await Click.deleteMany({ link: link._id });
    await link.deleteOne();
    res.status(204).end();
  });

  return router;
}

/** Another user's link is reported as not found, so ids can't be probed. */
export async function findOwnedLink(id: string, userId: string) {
  if (!isValidObjectId(id)) return null;
  return Link.findOne({ _id: id, owner: userId });
}
