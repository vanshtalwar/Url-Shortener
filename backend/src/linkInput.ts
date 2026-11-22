const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;
// Express matches routes case-insensitively, so these are compared lowercased.
const RESERVED_ALIASES: readonly string[] = ['api', 'health'];
const MAX_URL_LENGTH = 2048;

export interface LinkInput {
  readonly url?: string;
  readonly alias?: string;
  readonly expiresAt?: Date | null; // null removes the expiry
}

type ParseResult = { readonly input: LinkInput } | { readonly error: string };

function urlError(value: unknown): string | null {
  if (typeof value !== 'string') return 'url is required';
  if (value.length > MAX_URL_LENGTH) return `url must be at most ${MAX_URL_LENGTH} characters`;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? null : 'url must start with http:// or https://';
  } catch {
    return 'url is not a valid URL';
  }
}

function aliasError(value: unknown): string | null {
  if (typeof value !== 'string' || !ALIAS_PATTERN.test(value)) {
    return 'alias must be 3-30 characters: letters, digits, - or _';
  }
  return RESERVED_ALIASES.includes(value.toLowerCase()) ? 'alias is reserved' : null;
}

function expiryError(value: unknown, now: number): string | null {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return 'expiresAt must be an ISO date string';
  return time > now ? null : 'expiresAt must be in the future';
}

/**
 * Validates a create ("create") or partial update ("update") request body.
 * Only fields present in the body appear in the result. On create, an empty alias means "pick a random code".
 */
export function parseLinkInput(body: unknown, mode: 'create' | 'update', now: number): ParseResult {
  const { url, alias, expiresAt } = (body ?? {}) as Record<string, unknown>;
  const hasAlias = alias !== undefined && !(mode === 'create' && alias === '');
  const hasExpiry = expiresAt !== undefined && expiresAt !== null;

  const error =
    (url !== undefined || mode === 'create' ? urlError(url) : null) ??
    (hasAlias ? aliasError(alias) : null) ??
    (hasExpiry ? expiryError(expiresAt, now) : null);
  if (error) return { error };

  return {
    input: {
      ...(url !== undefined ? { url: url as string } : {}),
      ...(hasAlias ? { alias: alias as string } : {}),
      ...(expiresAt !== undefined ? { expiresAt: hasExpiry ? new Date(expiresAt as string) : null } : {}),
    },
  };
}
