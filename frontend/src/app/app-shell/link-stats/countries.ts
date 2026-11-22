// Country display helpers. Names come from the browser (Intl.DisplayNames), so no name list ships with the app.

let regionNames: Intl.DisplayNames | null | undefined;

/** "IN" → "India"; unknown codes and "Unknown" are returned as they are. */
export function countryName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      regionNames = null; // very old browser: show codes
    }
  }
  if (!regionNames || !/^[A-Z]{2}$/.test(code)) return code;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Mumbai, IN" (from the API) → "Mumbai, India". */
export function cityLabel(value: string): string {
  const match = /^(.*), ([A-Z]{2})$/.exec(value);
  return match ? `${match[1]}, ${countryName(match[2])}` : value;
}
