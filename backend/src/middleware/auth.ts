import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const TOKEN_LIFETIME = '7d';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: TOKEN_LIFETIME });
}

/** Requires `Authorization: Bearer <jwt>`; sets res.locals.userId. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) throw new Error('bad payload');
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
};
