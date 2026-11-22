import type { Link, LinkInput, Variant } from '../../links.service';
import { fromLocalInput, toLocalInput } from './form-utils';
import { applyUtm, emptyUtm, splitUtm, type Utm } from './utm';

/** What the link editor edits. */
export interface LinkForm {
  base: string; // destination without utm_* (when the UTM builder is available)
  utm: Utm;
  alias: string;
  expiresAt: string; // datetime-local value, '' = none
  password: string; // new password to set ('' = keep / none)
  removePassword: boolean;
  split: boolean; // A/B split on
  variants: Variant[];
  folderId: string; // '' = none
  tags: string[];
}

export interface Abilities {
  utm: boolean; // UTM builder (Pro)
  variants: boolean; // A/B (Pro)
  folders: boolean; // folders & tags (Pro)
}

/** Editor state for a new link (optionally pre-filled) or an existing one. Pure. */
export function formFor(link: Link | null, can: Abilities, initialUrl = ''): LinkForm {
  const url = link?.url ?? initialUrl;
  // Without the UTM builder, show the full URL in one field rather than splitting it into locked fields.
  const { base, utm } = can.utm ? splitUtm(url) : { base: url, utm: emptyUtm() };
  return {
    base,
    utm,
    alias: link?.code ?? '',
    expiresAt: toLocalInput(link?.expiresAt ?? null),
    password: '',
    removePassword: false,
    split: (link?.variants.length ?? 0) > 0,
    variants: link?.variants.map((v) => ({ ...v })) ?? [],
    folderId: link?.folderId ?? '',
    tags: [...(link?.tags ?? [])],
  };
}

const normalize = (url: string) => {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
};
const sameList = (a: readonly unknown[], b: readonly unknown[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The request body: everything for a new link; for an existing one only what changed (so untouched fields,
 * e.g. a past expiry, aren't re-validated). Pro-only fields are only ever sent when the plan allows them. Pure.
 */
export function buildChanges(original: Link | null, form: LinkForm, can: Abilities): LinkInput {
  const variants = form.split ? form.variants.map((v) => ({ url: v.url.trim(), weight: v.weight })) : [];
  // The API always needs a main URL; with a split and no main URL typed, use the first destination.
  const url = applyUtm(form.base.trim(), can.utm ? form.utm : emptyUtm()) || (can.variants ? variants[0]?.url ?? '' : '');
  const alias = form.alias.trim();
  const folderId = form.folderId || null;
  const password = form.removePassword ? null : form.password || undefined;

  if (!original) {
    return {
      url,
      ...(alias ? { alias } : {}),
      ...(form.expiresAt ? { expiresAt: fromLocalInput(form.expiresAt) } : {}),
      ...(password ? { password } : {}),
      ...(can.variants && variants.length ? { variants } : {}),
      ...(can.folders && folderId ? { folderId } : {}),
      ...(can.folders && form.tags.length ? { tags: form.tags } : {}),
    };
  }
  return {
    ...(normalize(url) !== normalize(original.url) ? { url } : {}),
    ...(alias !== original.code ? { alias } : {}),
    ...(form.expiresAt !== toLocalInput(original.expiresAt) ? { expiresAt: fromLocalInput(form.expiresAt) } : {}),
    ...(password !== undefined && !(password === null && !original.hasPassword) ? { password } : {}),
    ...(can.variants && !sameList(variants, original.variants) ? { variants } : {}),
    ...(can.folders && folderId !== original.folderId ? { folderId } : {}),
    ...(can.folders && !sameList(form.tags, original.tags) ? { tags: form.tags } : {}),
  };
}
