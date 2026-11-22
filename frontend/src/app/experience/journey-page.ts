import { Journey, Moment, Progress } from './journey';
import type { Pins } from './live';
import { readDeviceHints, startingTier } from './quality';
import { anchor, devExpose, devPinnedTier, Live, LiveRig, paintStill, startFrames } from './rig';
import { Stage } from './stage';

const MOMENTS: Moment[] = ['hero', 'qr', 'bars', 'globe', 'split', 'lock', 'pricing', 'cta'];

/**
 * A page that runs the whole 3D journey (prompts/zelqit-frontend.md §4): the landing page, and the Features page with
 * shorter pins. Loaded as its own chunk after first paint.
 *
 * Live: one canvas fixed over the viewport, particles behind the page, Lenis smooth scroll and a single GSAP-driven
 * frame loop; ScrollTrigger scrubs the journey (journey.ts) and pins the QR, bar-chart, A/B and padlock sections for
 * `pins` of scroll while their moments play. The sections hand their palettes to <html>, so the whole page
 * cross-fades to the palette of the section in the middle of the screen. GSAP and Lenis are a second chunk
 * (./live), loaded only for live mode: importing GSAP starts its ticker.
 * Still (prefers-reduced-motion, or a device that proves too slow): each moment's end pose drawn once inside its
 * anchor; sections keep their own colours; no loop, pins, particles, reveals or smooth scroll.
 *
 * `page` holds the sections (`data-palette`, and `data-xp-section` on the ones the journey travels through) and
 * one anchor per moment (`data-xp-anchor="…"`: boxes in the layout where the 3D appears; their SVG stand-ins are
 * hidden once drawn, via `data-xp-drawn`). Rejects without WebGL. Draws the first frame before resolving. The
 * resolved function removes everything.
 */
export async function startJourney(page: HTMLElement, pins: Pins): Promise<() => void> {
  const anchors = Object.fromEntries(MOMENTS.map((moment) => [moment, anchor(page, moment)])) as Record<Moment, HTMLElement>;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = reducedMotion ? null : await import('./live');
  const stage = new Stage(live ? devPinnedTier() ?? startingTier(readDeviceHints()) : 'still');
  const journey = new Journey(stage, `${location.origin}/`); // the QR code really scans: to this site
  journey.setTier(stage.tier);

  let stop = live ? goLive(live) : showStills();

  function goLive(live: Live): () => void {
    const rig = new LiveRig(page, stage, Array.from(page.querySelectorAll<HTMLElement>('section')));
    MOMENTS.forEach((moment) => (anchors[moment].dataset['xpDrawn'] = ''));

    // The bar-chart moment's sample numbers (landing) count up as its bars rise.
    const counters = Array.from(page.querySelectorAll<HTMLElement>('[data-xp-count]')).map((element) => ({
      element,
      final: Number(element.dataset['xpCount']),
      text: element.textContent ?? '',
    }));

    const progress: Progress = { toShare: 0, share: 0, toKnow: 0, know: 0, toWhere: 0, toTest: 0, test: 0, toProtect: 0, protect: 0, toPricing: 0, toCta: 0 };
    devExpose({ xpProgress: progress, xpTier: () => stage.tier, xpFollow: journey.follow });
    const boxes = {} as Record<Moment, DOMRect>;
    let tracker: ReturnType<Live['trackJourney']> | null = null;
    const draw = (seconds: number) => {
      MOMENTS.forEach((moment) => (boxes[moment] = anchors[moment].getBoundingClientRect()));
      tracker?.read(progress);
      const qrShown = progress.share > 0.5 && progress.toKnow < 0.3; // keep its quiet zone clean so it scans
      rig.frame(seconds, qrShown ? boxes.qr : null);
      stage.setLayer(journey.update(stage, progress, boxes, seconds, rig.tilt.x, rig.tilt.y, rig.pointer));
      stage.render();

      const counted = 1 - (1 - Math.min(1, progress.know / 0.8)) ** 3;
      for (const counter of counters) {
        const text = Math.round(counter.final * counted).toLocaleString('en-US');
        if (counter.element.textContent !== text) counter.element.textContent = text;
      }
    };

    const stopFrames = startFrames(
      live,
      stage,
      draw,
      (tier) => {
        stage.setTier(tier);
        journey.setTier(tier);
        rig.resize();
      },
      () => {
        stop();
        stop = showStills();
      },
    );
    tracker = live.trackJourney(page, pins); // pins first, so the headline reveals below are measured with them in place
    const undoReveals = live.revealHeadlines(page);
    draw(0); // now, so the stand-ins can go without a blank frame

    return () => {
      undoReveals();
      tracker?.kill();
      stopFrames();
      rig.stop();
      counters.forEach(({ element, text }) => (element.textContent = text));
      MOMENTS.forEach((moment) => delete anchors[moment].dataset['xpDrawn']);
    };
  }

  function showStills(): () => void {
    stage.tier = 'still';
    const stops = MOMENTS.map((moment) => paintStill(stage, anchors[moment], (box) => journey.still(stage, moment, box)));
    return () => stops.forEach((stopStill) => stopStill());
  }

  return () => {
    stop();
    journey.dispose();
    stage.dispose();
  };
}
