export const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Record<UtmKey, string>;

export function emptyUtm(): Utm {
  return { source: '', medium: '', campaign: '', term: '', content: '' };
}

function hasUtm(utm: Utm): boolean {
  return UTM_KEYS.some((k) => utm[k].trim() !== '');
}

/**
 * Splits a destination into the URL without utm_* parameters and the UTM values. URLs without UTM
 * parameters (or that don't parse) come back unchanged, so re-saving never rewrites them. Pure.
 */
export function splitUtm(url: string): { base: string; utm: Utm } {
  const utm = emptyUtm();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { base: url, utm };
  }
  if (!UTM_KEYS.some((k) => parsed.searchParams.has(`utm_${k}`))) return { base: url, utm };
  for (const key of UTM_KEYS) {
    utm[key] = parsed.searchParams.get(`utm_${key}`) ?? '';
    parsed.searchParams.delete(`utm_${key}`);
  }
  return { base: parsed.toString(), utm };
}

/** The destination with non-empty UTM values set as utm_* parameters (other parameters are kept). Pure. */
export function applyUtm(base: string, utm: Utm): string {
  if (!hasUtm(utm)) return base;
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return base; // the URL field shows its own error
  }
  for (const key of UTM_KEYS) {
    const value = utm[key].trim();
    if (value) parsed.searchParams.set(`utm_${key}`, value);
    else parsed.searchParams.delete(`utm_${key}`);
  }
  return parsed.toString();
}
