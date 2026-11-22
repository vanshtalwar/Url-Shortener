import { NgZone } from '@angular/core';

// How pages start their 3D (src/app/experience) without slowing first paint — the marketing pages and the
// dashboard's scenes — and how the marketing pages' header, footer and background follow the section palettes.

/** Runs `task` when the browser is idle (at most ~3 s later). Returns a cancel function. */
function whenIdle(task: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(task, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(task, 1500);
  return () => clearTimeout(id);
}

/**
 * Runs `task` once the page's first contentful paint is on screen and the browser is idle. Idle alone isn't enough:
 * it can come before that frame is presented, and WebGL start-up would then delay it. Returns a cancel function.
 */
export function afterFirstPaint(task: () => void): () => void {
  let cancel: () => void;
  if (!PerformanceObserver.supportedEntryTypes?.includes('paint')) {
    const id = requestAnimationFrame(() => (cancel = whenIdle(task))); // runs once rendering has started
    cancel = () => cancelAnimationFrame(id);
  } else {
    const observer = new PerformanceObserver((entries) => {
      if (!entries.getEntriesByName('first-contentful-paint').length) return;
      observer.disconnect();
      cancel = whenIdle(task);
    });
    observer.observe({ type: 'paint', buffered: true }); // buffered: already painted (in-app navigation) fires at once
    cancel = () => observer.disconnect();
  }
  return () => cancel();
}

/**
 * Loads a 3D experience chunk after first paint and starts it, all outside Angular (its frame loop and listeners
 * never trigger change detection). Without WebGL, or if the chunk fails, the page keeps its static SVG stand-ins.
 * Returns a stop function, safe to call at any point (before loading, while starting, or once running).
 */
export function startAfterFirstPaint<M>(zone: NgZone, load: () => Promise<M>, start: (module: M) => Promise<() => void>): () => void {
  let stopped = false;
  let stopExperience: (() => void) | undefined;
  const cancel = zone.runOutsideAngular(() =>
    afterFirstPaint(() => {
      load()
        .then((module) => (stopped ? undefined : start(module)))
        .then((stop) => {
          if (stopped) stop?.(); // left the page while it was starting
          else stopExperience = stop;
        })
        .catch((error) => console.warn('3D experience unavailable; keeping the static page.', error));
    }),
  );
  return () => {
    stopped = true;
    cancel();
    stopExperience?.();
  };
}

/**
 * The header, footer and page background take the palette of the section in the middle of the screen
 * (`data-palette` on <html>). In live 3D mode the sections hand their palettes to <html> as well, so everything on
 * screen shares it (experience/rig.ts). Sections without a palette (the CTA) keep the last one. Runs outside
 * Angular; returns a stop function.
 */
export function followSectionPalette(zone: NgZone, page: HTMLElement): () => void {
  const root = document.documentElement;
  const sections = Array.from(page.querySelectorAll<HTMLElement>('section'));
  const update = () => {
    const middle = window.innerHeight / 2;
    const section = sections.find((s) => {
      const box = s.getBoundingClientRect();
      return box.top <= middle && box.bottom > middle;
    });
    const palette = section?.dataset['palette'] ?? section?.dataset['xpPalette'];
    if (palette && root.dataset['palette'] !== palette) root.dataset['palette'] = palette;
  };
  update();
  zone.runOutsideAngular(() => {
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  });
  return () => {
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    delete root.dataset['palette'];
  };
}
