import { Journey, Moment, Progress } from './journey';
import { Particles, particleCount } from './particles';
import { FrameRateGuard, readDeviceHints, startingTier, Tier, TIER_SETTINGS } from './quality';
import { Stage } from './stage';

type Live = typeof import('./live');
declare const ngDevMode: unknown; // Angular's dev-build flag; production builds replace it with false

const MOMENTS: Moment[] = ['hero', 'qr', 'bars', 'globe', 'split', 'lock', 'pricing', 'cta'];

/**
 * The landing page's 3D journey (prompts/zelqit-frontend.md §4). Loaded as its own chunk after first paint.
 *
 * Live: one canvas fixed over the viewport, particles on a 2D canvas behind the page, Lenis smooth scroll and a
 * single GSAP-driven frame loop; ScrollTrigger scrubs the journey (journey.ts) and pins the QR and bar-chart
 * sections while their moments play. The sections hand their palettes to <html>, so the whole page cross-fades to
 * the palette of the section in the middle of the screen. GSAP and Lenis are a second chunk (./live), loaded only
 * for live mode: importing GSAP starts its ticker.
 * Still (prefers-reduced-motion, or a device that proves too slow): each moment's end pose drawn once inside its
 * anchor; sections keep their own colours; no loop, pins, particles, reveals or smooth scroll.
 *
 * `page` holds the sections (`data-palette`) and anchors (`data-xp-anchor="…"`: boxes in the layout where the 3D
 * appears; their SVG stand-ins are hidden once drawn, via `data-xp-drawn`).
 * Rejects without WebGL. Draws the first frame before resolving. The resolved function removes everything.
 */
export async function startLanding(page: HTMLElement): Promise<() => void> {
  const anchors = Object.fromEntries(MOMENTS.map((moment) => [moment, anchor(page, moment)])) as Record<Moment, HTMLElement>;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = reducedMotion ? null : await import('./live');
  const pinnedTier = devPinnedTier();
  const stage = new Stage(live ? pinnedTier ?? startingTier(readDeviceHints()) : 'still');
  const journey = new Journey(stage, `${location.origin}/`); // the QR code really scans: to this site
  journey.setTier(stage.tier);

  let stop = live ? goLive(live) : showStills();

  function goLive({ startLoop, revealHeadlines, trackJourney }: Live): () => void {
    const sections = Array.from(page.querySelectorAll<HTMLElement>('section'));
    const restorePalettes = handPalettesToPage(sections);
    const particles = new Particles();
    page.appendChild(particles.canvas);
    stage.attach(page, 'front');
    MOMENTS.forEach((moment) => (anchors[moment].dataset['xpDrawn'] = ''));

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = stage.canvas;
      stage.resize(width, height);
      const { maxPixelRatio, particleShare } = TIER_SETTINGS[stage.tier];
      particles.resize(width, height, Math.min(window.devicePixelRatio, maxPixelRatio, 1.5), particleCount(width, height, particleShare));
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage.canvas);
    resize();

    // Pointer parallax, eased towards each frame.
    const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onPointer = (e: PointerEvent) => {
      tilt.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      tilt.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    // The bar-chart moment's sample numbers count up as its bars rise.
    const counters = Array.from(page.querySelectorAll<HTMLElement>('[data-xp-count]')).map((element) => ({
      element,
      final: Number(element.dataset['xpCount']),
      text: element.textContent ?? '',
    }));

    const root = document.documentElement;
    const progress: Progress = { toShare: 0, share: 0, toKnow: 0, know: 0, toWhere: 0, toTest: 0, test: 0, toProtect: 0, protect: 0, toPricing: 0, toCta: 0 };
    // Development builds only: lets scripts/ui-check screenshot each moment at its end and see the quality tier.
    const debug = typeof ngDevMode !== 'undefined' && ngDevMode ? (window as Window & { xpProgress?: Progress; xpTier?: () => string }) : null;
    if (debug) {
      debug.xpProgress = progress;
      debug.xpTier = () => stage.tier;
    }
    const boxes = {} as Record<Moment, DOMRect>;
    let tracker: ReturnType<Live['trackJourney']> | null = null;
    const draw = (seconds: number) => {
      // Particles float over sections 1–7 only: not over the FAQ (data-xp-quiet) or the CTA (no palette).
      const middle = sectionAt(sections, window.innerHeight / 2);
      const particlesOn = middle && 'xpPalette' in middle.dataset && !('xpQuiet' in middle.dataset) ? 1 : 0;
      MOMENTS.forEach((moment) => (boxes[moment] = anchors[moment].getBoundingClientRect()));
      tracker?.read(progress);
      const qrShown = progress.share > 0.5 && progress.toKnow < 0.3; // keep its quiet zone clean so it scans
      particles.draw(seconds, window.scrollY, getComputedStyle(root).getPropertyValue('--tint').trim(), particlesOn, qrShown ? boxes.qr : null);

      tilt.x += (tilt.targetX - tilt.x) * 0.05;
      tilt.y += (tilt.targetY - tilt.y) * 0.05;
      stage.setLayer(journey.update(stage, progress, boxes, seconds, tilt.x, tilt.y));
      stage.render();

      const counted = 1 - (1 - Math.min(1, progress.know / 0.8)) ** 3;
      for (const counter of counters) {
        const text = Math.round(counter.final * counted).toLocaleString('en-US');
        if (counter.element.textContent !== text) counter.element.textContent = text;
      }
    };

    const guard = pinnedTier
      ? null
      : new FrameRateGuard(stage.tier, (tier) => {
          if (tier !== 'still') {
            stage.setTier(tier);
            journey.setTier(tier);
            return resize();
          }
          stop();
          stop = showStills();
        });
    const burn = devFrameCost();
    const stopLoop = startLoop((seconds) => {
      draw(seconds);
      if (burn) for (const until = performance.now() + burn; performance.now() < until; ); // dev only: fake a slow device
      guard?.frame(seconds * 1000); // last: it may swap this loop for stills
    });
    tracker = trackJourney(page); // pins first, so the headline reveals below are measured with them in place
    const undoReveals = revealHeadlines(page);
    draw(0); // now, so the stand-ins can go without a blank frame

    return () => {
      undoReveals();
      tracker?.kill();
      stopLoop();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointer);
      stage.canvas.remove();
      particles.dispose();
      restorePalettes();
      counters.forEach(({ element, text }) => (element.textContent = text));
      MOMENTS.forEach((moment) => delete anchors[moment].dataset['xpDrawn']);
    };
  }

  function showStills(): () => void {
    stage.tier = 'still';
    const stops = MOMENTS.map((moment) => paintStill(moment, anchors[moment]));
    return () => stops.forEach((stopStill) => stopStill());
  }

  /** One moment's end pose, drawn into a 2D canvas filling its anchor; redrawn only when the anchor resizes. */
  function paintStill(moment: Moment, host: HTMLElement): () => void {
    const still = document.createElement('canvas');
    still.setAttribute('aria-hidden', 'true');
    still.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    host.appendChild(still);
    host.dataset['xpDrawn'] = '';

    let drawnSize = '';
    const paint = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height || `${width}x${height}` === drawnSize) return;
      drawnSize = `${width}x${height}`;
      stage.resize(width, height);
      journey.still(stage, moment, { left: 0, top: 0, width, height });
      stage.render();
      still.width = stage.canvas.width;
      still.height = stage.canvas.height;
      still.getContext('2d')?.drawImage(stage.canvas, 0, 0); // same task as the render, before the buffer is cleared
    };
    const resizeObserver = new ResizeObserver(paint);
    resizeObserver.observe(host);
    paint();

    return () => {
      resizeObserver.disconnect();
      still.remove();
      delete host.dataset['xpDrawn'];
    };
  }

  return () => {
    stop();
    journey.dispose();
    stage.dispose();
  };
}

/** Development builds only: `localStorage['xp-tier']` pins the quality tier (no frame-rate downgrades) for tests. */
function devPinnedTier(): Exclude<Tier, 'still'> | null {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return null;
  try {
    const tier = localStorage.getItem('xp-tier');
    return tier === 'high' || tier === 'medium' || tier === 'low' ? tier : null;
  } catch {
    return null;
  }
}

/** Development builds only: `localStorage['xp-slow']` ms of busy work per frame, to test the switch to stills. */
function devFrameCost(): number {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return 0;
  try {
    return Number(localStorage.getItem('xp-slow')) || 0;
  } catch {
    return 0;
  }
}

function anchor(page: HTMLElement, name: string): HTMLElement {
  const element = page.querySelector<HTMLElement>(`[data-xp-anchor="${name}"]`);
  if (!element) throw new Error(`Landing: anchor "${name}" not found`);
  return element;
}

function sectionAt(sections: HTMLElement[], y: number): HTMLElement | undefined {
  return sections.find((section) => {
    const box = section.getBoundingClientRect();
    return box.top <= y && box.bottom > y;
  });
}

/** Colour tokens from src/styles.css, all "R G B" triples except --accent-underline (0 or 1). */
const COLOUR_TOKENS = ['canvas', 'surface', 'surface-2', 'line', 'ink', 'muted', 'accent', 'brand-glow', 'tint', 'headline-accent', 'success', 'warning', 'danger'];
let tokensTyped = false;

/**
 * Sections stop painting their own palette (data-palette → data-xp-palette) and become transparent, so the
 * palette on <html> — set by the landing component for the section in the middle of the screen — colours the whole
 * page, and the particles and 3D can show behind the text. Palette changes cross-fade over 0.6 s: the tokens are
 * registered as number lists so they can transition (once per document; browsers without it switch instantly).
 * Registered here rather than in styles.css to keep the initial CSS small.
 */
function handPalettesToPage(sections: HTMLElement[]): () => void {
  // CSS Properties and Values API (not in TypeScript 4.7's DOM types).
  const css = CSS as typeof CSS & { registerProperty?(definition: { name: string; syntax: string; inherits: boolean; initialValue: string }): void };
  if (!tokensTyped && css.registerProperty) {
    for (const name of COLOUR_TOKENS) css.registerProperty({ name: `--${name}`, syntax: '<number>+', inherits: true, initialValue: '0 0 0' });
    css.registerProperty({ name: '--accent-underline', syntax: '<number>', inherits: true, initialValue: '0' });
    tokensTyped = true;
  }
  const root = document.documentElement;
  const painted = sections.filter((section) => section.dataset['palette']);
  for (const section of painted) {
    section.dataset['xpPalette'] = section.dataset['palette'];
    delete section.dataset['palette'];
  }
  root.style.transition = [...COLOUR_TOKENS, 'accent-underline'].map((name) => `--${name} 0.6s ease`).join(', ');
  return () => {
    root.style.removeProperty('transition');
    for (const section of painted) {
      section.dataset['palette'] = section.dataset['xpPalette'];
      delete section.dataset['xpPalette'];
    }
  };
}
