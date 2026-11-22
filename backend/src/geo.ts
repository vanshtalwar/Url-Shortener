import { existsSync } from 'node:fs';
import { open, validate, type CityResponse, type Reader } from 'maxmind';

interface GeoLocation {
  country: string; // ISO 3166-1 alpha-2, e.g. "IN", or "Unknown"
  city: string; // English name, or "Unknown"
}

/** Looks up where an IP is. Never throws; unknown → "Unknown". Swapped for a fake in tests. */
export type GeoLookup = (ip: string | undefined) => Promise<GeoLocation>;

const UNKNOWN: GeoLocation = { country: 'Unknown', city: 'Unknown' };

/** Reads the country code and English city name from a GeoLite2 City record. Pure. */
export function toLocation(record: CityResponse | null): GeoLocation {
  return {
    country: record?.country?.iso_code ?? record?.registered_country?.iso_code ?? 'Unknown',
    city: record?.city?.names?.en ?? 'Unknown',
  };
}

/** IPv4 clients often appear as "::ffff:1.2.3.4" on dual-stack servers. Pure. */
function plainIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

/** GeoLite2 City lookup. Opens the database on first use; if it's missing the app still runs and locations are Unknown. */
export function createGeoLookup(dbPath: string): GeoLookup {
  let reader: Promise<Reader<CityResponse> | null> | undefined;
  const load = () =>
    (reader ??= existsSync(dbPath)
      ? open<CityResponse>(dbPath, { cache: { max: 10_000 } }).catch((err) => {
          console.error(`Could not open GeoIP database at ${dbPath}:`, err);
          return null;
        })
      : (console.warn(`GeoIP database not found at ${dbPath}; click locations will be Unknown`), Promise.resolve(null)));

  return async (rawIp) => {
    const db = await load();
    const ip = rawIp && plainIp(rawIp);
    if (!db || !ip || !validate(ip)) return UNKNOWN;
    return toLocation(db.get(ip));
  };
}
