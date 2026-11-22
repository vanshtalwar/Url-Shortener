import { createHash } from 'node:crypto';
import { isbot } from 'isbot';
import UAParser from 'ua-parser-js';

interface VisitRequest {
  readonly userAgent: string;
  readonly referer: string | undefined;
  readonly ip: string | undefined;
}

function referrerHost(referer: string | undefined): string {
  if (!referer) return '';
  try {
    return new URL(referer).hostname;
  } catch {
    return '';
  }
}

/** Turns the raw request details of one redirect into the fields stored on a Click. Pure. */
export function describeVisit({ userAgent, referer, ip }: VisitRequest, salt: string) {
  const ua = new UAParser(userAgent).getResult();
  return {
    referrer: referrerHost(referer),
    browser: ua.browser.name ?? 'Unknown',
    os: ua.os.name ?? 'Unknown',
    // ua-parser leaves device.type empty for desktops; with no OS either, we genuinely don't know.
    deviceType: ua.device.type ?? (ua.os.name ? 'desktop' : 'unknown'),
    isBot: isbot(userAgent),
    visitorHash: createHash('sha256').update(`${salt}|${ip}|${userAgent}`).digest('hex'),
  };
}
