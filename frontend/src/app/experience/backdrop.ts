import { Particles, particleCount } from './particles';
import { FrameRateGuard, readDeviceHints, startingTier, Tier, TIER_SETTINGS } from './quality';
import { devFrameCost, devPinnedTier } from './rig';

const SHARE = 0.5; // half as many particles as the marketing pages…
const VISIBLE = 0.45; // …and fainter: the dashboard is for work

/**
 * The dashboard's background particles (prompts/zelqit-frontend.md §4, X12): the landing's drifting link loops and
 * QR squares, fewer and fainter, in the brand glow colour, on a 2D canvas behind the app (`host`'s children).
 * About 30 frames a second, none while the tab is hidden. Not started on the `low` tier; stopped if frames get
 * slow. The caller handles the Settings switch and reduced motion (ui/particles-preference.service.ts).
 * Resolves to a stop function.
 */
export async function startBackdrop(host: HTMLElement): Promise<() => void> {
  let tier: Tier = devPinnedTier() ?? startingTier(readDeviceHints());
  if (tier === 'low') return () => undefined;

  const particles = new Particles();
  host.appendChild(particles.canvas);
  const resize = () => {
    const { clientWidth: width, clientHeight: height } = particles.canvas;
    const { maxPixelRatio, particleShare } = TIER_SETTINGS[tier];
    particles.resize(width, height, Math.min(window.devicePixelRatio, maxPixelRatio, 1.5), particleCount(width, height, particleShare * SHARE));
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(particles.canvas);
  resize();

  let frame = 0;
  let skip = false;
  const burn = devFrameCost();
  const guard = devPinnedTier()
    ? null
    : new FrameRateGuard(tier, (next) => {
        tier = next;
        if (next === 'medium') resize();
        else stop();
      });
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    skip = !skip;
    if (!skip) {
      const tint = getComputedStyle(document.documentElement).getPropertyValue('--brand-glow').trim(); // follows the theme
      particles.draw(now / 1000, window.scrollY, tint, VISIBLE);
    }
    if (burn) for (const until = performance.now() + burn; performance.now() < until; ); // dev only: fake a slow device
    guard?.frame(now); // every frame, drawn or not: last, as it may stop the loop
  };
  frame = requestAnimationFrame(tick);

  function stop(): void {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    particles.dispose();
  }
  return stop;
}
