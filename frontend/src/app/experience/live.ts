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

/**
 * The landing journey's scroll ranges (journey.ts `Progress`): travels between sections, and pins that hold the QR
 * and bar-chart sections while their moments play. Pins start when the section's 3D box reaches the middle of the
 * screen, so it's in view at any width. Call after startLoop. Returns a progress reader and a kill function.
 */
export function trackJourney(page: HTMLElement): { read(target: Progress): Progress; kill(): void } {
  const section = (title: string) => page.querySelector<HTMLElement>(`section[aria-labelledby="${title}"]`);
  const box = (name: string) => page.querySelector<HTMLElement>(`[data-xp-anchor="${name}"]`);
  const sections = ['share', 'know', 'where', 'test', 'protect', 'pricing', 'cta'].map((name) => section(`${name}-title`));
  const boxes = ['qr', 'bars', 'globe', 'split', 'lock', 'pricing', 'cta'].map(box);
  if (sections.some((s) => !s) || boxes.some((b) => !b)) throw new Error('Landing: journey sections not found');
  const [share, know, where, test, protect, pricing, cta] = sections as HTMLElement[];
  const [qr, bars, globe, split, lock, pricingBox, ctaBox] = boxes as HTMLElement[];
  // Travels run from a section's top entering the screen to its 3D box reaching the middle; pins hold the section
  // from there. Created in page order, so each one's position accounts for the pins above it.
  const travel = (into: HTMLElement, box: HTMLElement) => ScrollTrigger.create({ trigger: into, start: 'top bottom', endTrigger: box, end: 'center center' });
  const pin = (section: HTMLElement, box: HTMLElement, length: string) => ScrollTrigger.create({ trigger: box, start: 'center center', end: `+=${length}`, pin: section });
  const triggers: Record<keyof Progress, ScrollTrigger> = {
    toShare: travel(share, qr),
    share: pin(share, qr, '120%'),
    toKnow: travel(know, bars),
    know: pin(know, bars, '100%'),
    toWhere: travel(where, globe),
    toTest: travel(test, split),
    test: pin(test, split, '100%'),
    toProtect: travel(protect, lock),
    protect: pin(protect, lock, '100%'),
    toPricing: travel(pricing, pricingBox),
    toCta: travel(cta, ctaBox),
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
