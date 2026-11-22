import { BIO_THEMES } from './models/bio';

const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;
// Words that would clash with app routes or look official.
const RESERVED_HANDLES: readonly string[] = [
  'about', 'admin', 'api', 'app', 'billing', 'blog', 'contact', 'features', 'help', 'legal',
  'login', 'pricing', 'root', 'settings', 'signup', 'support', 'www', 'zelqit',
];
const MAX_LINKS = 20;
const MAX_TITLE = 60;
const MAX_DESCRIPTION = 160;
const MAX_LABEL = 60;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

interface BioInput {
  handle: string;
  title: string;
  description: string;
  theme: (typeof BIO_THEMES)[number];
  links: { linkId: string; label: string }[];
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : null);

/** Validates a full bio page (PUT replaces it). Returns the cleaned input or an error message. Pure. */
export function parseBioInput(body: unknown): BioInput | string {
  const raw = (body ?? {}) as Record<string, unknown>;
  const handle = text(raw.handle)?.toLowerCase() ?? '';
  if (!HANDLE_PATTERN.test(handle)) return 'handle must be 3-30 characters: lowercase letters, digits or _';
  if (RESERVED_HANDLES.includes(handle)) return 'that handle is reserved';

  const title = text(raw.title);
  if (!title || title.length > MAX_TITLE) return `title must be 1-${MAX_TITLE} characters`;
  const description = text(raw.description ?? '');
  if (description === null || description.length > MAX_DESCRIPTION) return `description must be at most ${MAX_DESCRIPTION} characters`;
  const theme = raw.theme ?? 'violet';
  if (!(BIO_THEMES as readonly unknown[]).includes(theme)) return `theme must be one of: ${BIO_THEMES.join(', ')}`;

  if (!Array.isArray(raw.links) || raw.links.length > MAX_LINKS) return `links must be a list of at most ${MAX_LINKS}`;
  const links: BioInput['links'] = [];
  for (const [i, item] of raw.links.entries()) {
    const { linkId, label } = (item ?? {}) as Record<string, unknown>;
    const cleanLabel = text(label);
    if (typeof linkId !== 'string' || !OBJECT_ID_PATTERN.test(linkId)) return `link ${i + 1}: invalid linkId`;
    if (!cleanLabel || cleanLabel.length > MAX_LABEL) return `link ${i + 1}: label must be 1-${MAX_LABEL} characters`;
    links.push({ linkId, label: cleanLabel });
  }
  return { handle, title, description, theme: theme as BioInput['theme'], links };
}
