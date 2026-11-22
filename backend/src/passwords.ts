import bcrypt from 'bcryptjs';

const MIN_LENGTH = 8;
const MAX_BYTES = 72; // bcrypt ignores anything longer
const COST = 10;
// Compared against when the account doesn't exist, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', COST);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 254 ? email : null;
}

/** Error message, or null when the password is acceptable. */
export function passwordError(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (Buffer.byteLength(value) > MAX_BYTES) return `Password must be at most ${MAX_BYTES} bytes`;
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

/** Always does one bcrypt comparison, whether or not a hash exists. */
export function checkPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH).then((ok) => ok && Boolean(hash));
}
