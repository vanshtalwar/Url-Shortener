import { createHash, randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { AuthToken } from './models/authToken';

type Purpose = 'verify-email' | 'reset-password';

const LIFETIME_MS: Record<Purpose, number> = {
  'verify-email': 24 * 60 * 60 * 1000,
  'reset-password': 60 * 60 * 1000,
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Creates a single-use token and returns the raw value to email. Replaces older tokens for the same purpose. */
export async function issueToken(userId: Types.ObjectId, purpose: Purpose): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await AuthToken.deleteMany({ user: userId, purpose });
  await AuthToken.create({ user: userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LIFETIME_MS[purpose]) });
  return token;
}

/** Atomically uses up a token. Returns its user id, or null if unknown, expired or already used. */
export async function consumeToken(token: unknown, purpose: Purpose): Promise<Types.ObjectId | null> {
  if (typeof token !== 'string' || !token) return null;
  const record = await AuthToken.findOneAndDelete({ tokenHash: sha256(token), purpose, expiresAt: { $gt: new Date() } }).lean();
  return record?.user ?? null;
}
