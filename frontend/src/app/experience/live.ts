import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import type { Progress } from './journey';

// Everything that needs GSAP lives in this module, so it's a separate chunk that only live mode loads:
// importing GSAP starts its ticker, which reduced-motion pages must never do.

let registered = false;

/**
 * The single frame loop of a live 3D page: GSAP's ticker → Lenis smooth scroll → ScrollTrigger → `draw`.
 * Lenis moves the page, ScrollTrigger reads the new position and `draw` renders — all in the same frame, so the
 * 3D never lags the HTML. Marketing pages only, never with reduced motion. Returns a stop function.
 */
export function startLoop(draw: (seconds: number) => void): () => void {
  // ScrollTrigger runs listeners and a 250 ms timer while enabled, so it's on only while a live page is open.
  // (Phone toolbars showing/hiding don't re-measure: ScrollTrigger ignores those resizes on touch devices by default.
  // Don't call ScrollTrigger.config() without syncInterval: it loses the id of its sync timer, which then never stops.)
  if (registered) ScrollTrigger.enable();
  else gsap.registerPlugin(ScrollTrigger, SplitText);
  registered = true;

  const lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (seconds: number) => {
    lenis.raf(seconds * 1000);
    draw(seconds);
  };
  gsap.ticker.lagSmoothing(0); // scrolling follows real time, not GSAP's lag-adjusted time
  gsap.ticker.add(tick);
  return () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33); // GSAP's default
    lenis.destroy();
    ScrollTrigger.disable();
  };
}

/**
 * Giant headlines still below the screen rise in line by line as they scroll into view. Headlines already visible
 * are left alone, so no text that's on screen ever disappears. Call after startLoop. Returns an undo function.
 */
export function revealHeadlines(root: HTMLElement): () => void {
  const splits = Array.from(root.querySelectorAll<HTMLElement>('.xp-headline'))
    .filter((headline) => headline.getBoundingClientRect().top > window.innerHeight)
    .map((headline) =>
      SplitText.create(headline, {
        type: 'lines',
        autoSplit: true, // re-split when the web fonts arrive or the width changes
        // Returning the tween lets SplitText kill it (and its ScrollTrigger) on re-split and revert.
        onSplit: (split: SplitText) =>
          gsap.from(split.lines, {
            yPercent: 60,
            opacity: 0,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: headline, start: 'top 85%', once: true },
          }),
      }),
    );
  return () => splits.forEach((split) => split.revert());
}

/** How much scroll (CSS length, e.g. "120%" of the viewport) each pinned moment holds its section for. */
export interface Pins {
  share: string;
  know: string;
  test: string;
  protect: string;
}

/**
 * The journey's scroll ranges (journey.ts `Progress`): travels between sections, and pins that hold the QR,
 * bar-chart, A/B and padlock sections while their moments play. Sections are found by `data-xp-section`, 3D boxes by
 * `data-xp-anchor`. Pins start when the section's 3D box reaches the middle of the screen, so it's in view at any
 * width. Call after startLoop. Returns a progress reader and a kill function.
 */
export function trackJourney(page: HTMLElement, pins: Pins): { read(target: Progress): Progress; kill(): void } {
  const find = (selector: string) => {
    const element = page.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Journey: ${selector} not found`);
    return element;
  };
  const section = (name: string) => find(`[data-xp-section="${name}"]`);
  const box = (name: string) => find(`[data-xp-anchor="${name}"]`);
  // Travels run from a section's top entering the screen to its 3D box reaching the middle; pins hold the section
  // from there. Created in page order, so each one's position accounts for the pins above it.
  const travel = (into: string, to: string) => ScrollTrigger.create({ trigger: section(into), start: 'top bottom', endTrigger: box(to), end: 'center center' });
  const pin = (name: string, at: string, length: string) => ScrollTrigger.create({ trigger: box(at), start: 'center center', end: `+=${length}`, pin: section(name) });
  const triggers: Record<keyof Progress, ScrollTrigger> = {
    toShare: travel('share', 'qr'),
    share: pin('share', 'qr', pins.share),
    toKnow: travel('know', 'bars'),
    know: pin('know', 'bars', pins.know),
    toWhere: travel('where', 'globe'),
    toTest: travel('test', 'split'),
    test: pin('test', 'split', pins.test),
    toProtect: travel('protect', 'lock'),
    protect: pin('protect', 'lock', pins.protect),
    toPricing: travel('pricing', 'pricing'),
    toCta: travel('cta', 'cta'),
  };
  document.fonts?.ready.then(() => ScrollTrigger.refresh()); // web fonts change section heights
  return {
    read(target) {
      for (const key of Object.keys(triggers) as (keyof Progress)[]) target[key] = triggers[key].progress;
      return target;
    },
    kill: () => Object.values(triggers).forEach((trigger) => trigger.kill()),
  };
}
