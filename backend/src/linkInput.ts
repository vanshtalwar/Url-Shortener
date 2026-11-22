const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;
// Express matches routes case-insensitively, so these are compared lowercased.
const RESERVED_ALIASES: readonly string[] = ['api', 'health'];
const MAX_URL_LENGTH = 2048;
const MAX_TAGS = 10;
const TAG_PATTERN = /^[a-z0-9][a-z0-9 _-]{0,23}$/; // after lowercasing/trimming
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const LINK_PASSWORD_MIN = 4;
const LINK_PASSWORD_MAX_BYTES = 72; // bcrypt limit
const MIN_VARIANTS = 2;
const MAX_VARIANTS = 5;
const MAX_WEIGHT = 100;

export interface LinkInput {
  readonly url?: string;
  readonly alias?: string;
  readonly expiresAt?: Date | null; // null removes the expiry
  readonly folderId?: string | null; // null removes it from its folder
  readonly tags?: readonly string[];
  readonly password?: string | null; // null removes the password
  readonly variants?: readonly Variant[]; // [] removes the A/B split
}

interface Variant {
  readonly url: string;
  readonly weight: number;
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

/** Lowercased, trimmed, de-duplicated tags, or an error message. Pure. */
function parseTags(value: unknown): readonly string[] | string {
  if (!Array.isArray(value) || !value.every((t) => typeof t === 'string')) return 'tags must be a list of strings';
  const tags = [...new Set(value.map((t: string) => t.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > MAX_TAGS) return `at most ${MAX_TAGS} tags`;
  const bad = tags.find((t) => !TAG_PATTERN.test(t));
  return bad === undefined ? tags : `invalid tag "${bad}": up to 24 letters, digits, spaces, - or _`;
}

function linkPasswordError(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length < LINK_PASSWORD_MIN) return `password must be at least ${LINK_PASSWORD_MIN} characters`;
  return Buffer.byteLength(value) > LINK_PASSWORD_MAX_BYTES ? `password must be at most ${LINK_PASSWORD_MAX_BYTES} bytes` : null;
}

/** Validated A/B variants ([] = remove), or an error message. Pure. */
function parseVariants(value: unknown): readonly Variant[] | string {
  if (!Array.isArray(value)) return 'variants must be a list';
  if (value.length === 0) return [];
  if (value.length < MIN_VARIANTS || value.length > MAX_VARIANTS) return `use ${MIN_VARIANTS}-${MAX_VARIANTS} variants`;
  const variants: Variant[] = [];
  for (const [i, v] of value.entries()) {
    const { url, weight } = (v ?? {}) as Record<string, unknown>;
    const error = urlError(url);
    if (error) return `variant ${i + 1}: ${error}`;
    if (!Number.isInteger(weight) || (weight as number) < 1 || (weight as number) > MAX_WEIGHT) return `variant ${i + 1}: weight must be 1-${MAX_WEIGHT}`;
    variants.push({ url: url as string, weight: weight as number });
  }
  return variants;
}

function folderError(value: unknown): string | null {
  return value === null || (typeof value === 'string' && OBJECT_ID_PATTERN.test(value)) ? null : 'folderId must be a folder id or null';
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
  const { url, alias, expiresAt, folderId, tags, password, variants } = (body ?? {}) as Record<string, unknown>;
  const parsedTags = tags !== undefined ? parseTags(tags) : undefined;
  const parsedVariants = variants !== undefined ? parseVariants(variants) : undefined;
  const hasAlias = alias !== undefined && !(mode === 'create' && alias === '');
  const hasExpiry = expiresAt !== undefined && expiresAt !== null;

  const error =
    (url !== undefined || mode === 'create' ? urlError(url) : null) ??
    (hasAlias ? aliasError(alias) : null) ??
    (hasExpiry ? expiryError(expiresAt, now) : null) ??
    (folderId !== undefined ? folderError(folderId) : null) ??
    (password !== undefined ? linkPasswordError(password) : null) ??
    (typeof parsedTags === 'string' ? parsedTags : null) ??
    (typeof parsedVariants === 'string' ? parsedVariants : null);
  if (error) return { error };

  return {
    input: {
      ...(url !== undefined ? { url: url as string } : {}),
      ...(hasAlias ? { alias: alias as string } : {}),
      ...(expiresAt !== undefined ? { expiresAt: hasExpiry ? new Date(expiresAt as string) : null } : {}),
      ...(folderId !== undefined ? { folderId: folderId as string | null } : {}),
      ...(Array.isArray(parsedTags) ? { tags: parsedTags } : {}),
      ...(password !== undefined ? { password: password as string | null } : {}),
      ...(Array.isArray(parsedVariants) ? { variants: parsedVariants } : {}),
    },
  };
}
