import { UrlMatchResult, UrlSegment } from '@angular/router';

/**
 * Top-level paths served by the auth pages module (kept at the root so URLs stay /login, /signup, …).
 * The theme script in src/index.html lists them too (those pages use the saved theme); keep both in sync.
 */
const AUTH_PATHS = ['login', 'signup', 'check-email', 'verify-email', 'forgot-password', 'reset-password'];

/** Matches /login, /signup, … without consuming the segment, so the auth module's own routes see it. */
export function authMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  return segments.length === 1 && AUTH_PATHS.includes(segments[0].path) ? { consumed: [] } : null;
}

/** Matches /@handle (public link-in-bio page) and exposes `handle` without the "@". */
export function bioMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  const [first] = segments;
  if (segments.length !== 1 || !first.path.startsWith('@') || first.path.length < 2) return null;
  return { consumed: segments, posParams: { handle: new UrlSegment(first.path.slice(1), {}) } };
}
