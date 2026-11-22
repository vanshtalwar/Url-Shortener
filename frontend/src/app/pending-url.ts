// A URL a visitor typed on the landing page before signing up, kept for this tab so the
// create-link form can pre-fill it after sign-in (read by the links page).
const KEY = 'zelqit-pending-url';

export function savePendingUrl(url: string | null): void {
  try {
    if (url) sessionStorage.setItem(KEY, url);
  } catch {
    // storage blocked: the visitor just retypes it
  }
}

/** Returns the pending URL once, then forgets it. */
export function takePendingUrl(): string | null {
  try {
    const url = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return url;
  } catch {
    return null;
  }
}
