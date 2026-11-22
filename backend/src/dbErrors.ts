/** True for MongoDB's "duplicate key" error (a unique index was violated). */
export function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 11000;
}
