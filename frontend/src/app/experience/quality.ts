/**
 * Rendering quality for the 3D experience (prompts/zelqit-frontend.md §4.3-7). Chosen once from device hints,
 * then only ever lowered while the page is open — never raised, so the picture doesn't flicker between tiers.
 * `still` = one rendered frame per section and no animation (also used for prefers-reduced-motion).
 */
export type Tier = 'high' | 'medium' | 'low' | 'still';

export const TIER_SETTINGS: Record<Tier, { maxPixelRatio: number; particleShare: number }> = {
  high: { maxPixelRatio: 2, particleShare: 1 },
  medium: { maxPixelRatio: 1.5, particleShare: 0.4 }, // phones start here
  low: { maxPixelRatio: 1, particleShare: 0.2 },
  still: { maxPixelRatio: 2, particleShare: 0 }, // drawn once, so it can be sharp; no particles
};

export interface DeviceHints {
  deviceMemory?: number; // GB; Chromium only
  cores?: number;
  saveData?: boolean;
  shortSide: number; // CSS px of the screen's shorter side: < 600 is a phone in either orientation
}

export function readDeviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return { deviceMemory: nav.deviceMemory, cores: nav.hardwareConcurrency, saveData: nav.connection?.saveData, shortSide: Math.min(screen.width, screen.height) };
}

/** Pure. Unknown hints count as capable; the frame-rate guard catches what they miss. */
export function startingTier(hints: DeviceHints): Exclude<Tier, 'still'> {
  const memory = hints.deviceMemory ?? Infinity;
  const cores = hints.cores ?? Infinity;
  if (hints.saveData || memory <= 2 || cores <= 2) return 'low';
  if (memory <= 4 || cores <= 4 || hints.shortSide < 600) return 'medium';
  return 'high';
}

const WINDOW_MS = 2000;
const PAUSE_MS = 500; // a longer gap between frames means the loop was paused (background tab), not slow

/**
 * Lowers the tier when frames stay slow: every 2 s, a median below 45 fps steps down one tier (not below `low`,
 * so a phone capped at 30 fps in power-saving mode keeps animating) and below 25 fps drops to `still`.
 * The median ignores one-off stalls such as a shader compiling.
 */
export class FrameRateGuard {
  private last = -Infinity;
  private windowStart = 0;
  private intervals: number[] = [];

  constructor(public tier: Tier, private readonly onDowngrade: (tier: Tier) => void) {}

  /** Call once per frame with a timestamp in ms. */
  frame(now: number): void {
    if (this.tier === 'still') return;
    const gap = now - this.last;
    this.last = now;
    if (gap > PAUSE_MS) {
      this.windowStart = now;
      this.intervals = [];
      return;
    }
    this.intervals.push(gap);
    if (now - this.windowStart < WINDOW_MS) return;

    const fps = 1000 / median(this.intervals);
    this.windowStart = now;
    this.intervals = [];
    const next: Tier = fps < 25 ? 'still' : fps < 45 && this.tier === 'high' ? 'medium' : fps < 45 && this.tier === 'medium' ? 'low' : this.tier;
    if (next !== this.tier) {
      this.tier = next;
      this.onDowngrade(next);
    }
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
