import { Particles, particleCount } from './particles';
import { FrameRateGuard, Tier, TIER_SETTINGS } from './quality';
import type { Stage } from './stage';

// Plumbing every 3D marketing page shares (the landing and Features journeys, the Pricing link): live mode's
// fixed canvas, particles, palettes, pointer tilt and frame loop; still frames; development-build test hooks.

export type Live = typeof import('./live');
declare const ngDevMode: unknown; // Angular's dev-build flag; production builds replace it with false

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The mouse on screen (CSS px); `on` is false before it first moves and while it's outside the window. */
export interface Pointer {
  x: number;
  y: number;
  on: boolean;
}

export function anchor(page: HTMLElement, name: string): HTMLElement {
  const element = page.querySelector<HTMLElement>(`[data-xp-anchor="${name}"]`);
  if (!element) throw new Error(`3D page: anchor "${name}" not found`);
  return element;
}

export function sectionAt(sections: HTMLElement[], y: number): HTMLElement | undefined {
  return sections.find((section) => {
    const box = section.getBoundingClientRect();
    return box.top <= y && box.bottom > y;
  });
}

/**
 * Live mode's page-level parts: the 3D canvas fixed over the page, particles behind it (2D canvas), the sections'
 * palettes handed to <html>, and pointer parallax. `sections` are the page's `<section>`s.
 */
export class LiveRig {
  /** Pointer parallax, −1…1, eased towards the pointer every frame. */
  readonly tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  /** The mouse, for what follows it (the hero link). Touch doesn't count: there it would fight scrolling. */
  readonly pointer: Pointer = { x: 0, y: 0, on: false };
  private readonly particles = new Particles();
  private readonly resizeObserver = new ResizeObserver(() => this.resize());
  private readonly restorePalettes: () => void;
  private readonly onPointer = (e: PointerEvent) => {
    this.tilt.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    this.tilt.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    if (e.pointerType === 'mouse') Object.assign(this.pointer, { x: e.clientX, y: e.clientY, on: true });
  };
  private readonly onLeave = (e: MouseEvent) => {
    if (!e.relatedTarget) this.pointer.on = false; // out of the window
  };

  constructor(page: HTMLElement, private readonly stage: Stage, private readonly sections: HTMLElement[]) {
    this.restorePalettes = handPalettesToPage(sections);
    page.appendChild(this.particles.canvas);
    stage.attach(page, 'front');
    this.resizeObserver.observe(stage.canvas);
    this.resize();
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('mouseout', this.onLeave, { passive: true });
  }

  /** Re-fit both canvases (also after a tier change). */
  resize(): void {
    const { clientWidth: width, clientHeight: height } = this.stage.canvas;
    this.stage.resize(width, height);
    const { maxPixelRatio, particleShare } = TIER_SETTINGS[this.stage.tier];
    this.particles.resize(width, height, Math.min(window.devicePixelRatio, maxPixelRatio, 1.5), particleCount(width, height, particleShare));
  }

  /**
   * Start of each frame: eases the tilt and draws the particles, which float only over sections with a palette and
   * no `data-xp-quiet`, and never inside `keepClear` (e.g. a QR code's quiet zone).
   */
  frame(seconds: number, keepClear: DOMRect | null = null): void {
    const middle = sectionAt(this.sections, window.innerHeight / 2);
    const on = middle && 'xpPalette' in middle.dataset && !('xpQuiet' in middle.dataset) ? 1 : 0;
    const tint = getComputedStyle(document.documentElement).getPropertyValue('--tint').trim();
    this.particles.draw(seconds, window.scrollY, tint, on, keepClear);
    this.tilt.x += (this.tilt.targetX - this.tilt.x) * 0.05;
    this.tilt.y += (this.tilt.targetY - this.tilt.y) * 0.05;
  }

  stop(): void {
    this.resizeObserver.disconnect();
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('mouseout', this.onLeave);
    this.stage.canvas.remove();
    this.particles.dispose();
    this.restorePalettes();
  }
}

/**
 * The frame loop (GSAP ticker → Lenis → ScrollTrigger → `draw`, see live.ts) with the frame-rate guard: a lower tier
 * goes to `onTier`; `still` goes to `toStills`, which must stop this loop. Returns a stop function.
 */
export function startFrames(live: Live, stage: Stage, draw: (seconds: number) => void, onTier: (tier: Tier) => void, toStills: () => void): () => void {
  const guard = devPinnedTier() ? null : new FrameRateGuard(stage.tier, (tier) => (tier === 'still' ? toStills() : onTier(tier)));
  const burn = devFrameCost();
  return live.startLoop((seconds) => {
    draw(seconds);
    if (burn) for (const until = performance.now() + burn; performance.now() < until; ); // dev only: fake a slow device
    guard?.frame(seconds * 1000); // last: it may swap this loop for stills
  });
}

/**
 * Still mode: `pose` the scene for this anchor (the stage is sized to it), render once into a 2D canvas filling the
 * anchor, and redraw only when the anchor resizes. Marks the anchor drawn (`data-xp-drawn` hides its SVG stand-in).
 */
export function paintStill(stage: Stage, host: HTMLElement, pose: (box: Box) => void): () => void {
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
    pose({ left: 0, top: 0, width, height });
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

/** Development builds only: `localStorage['xp-tier']` pins the quality tier (no frame-rate downgrades) for tests. */
export function devPinnedTier(): Exclude<Tier, 'still'> | null {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return null;
  try {
    const tier = localStorage.getItem('xp-tier');
    return tier === 'high' || tier === 'medium' || tier === 'low' ? tier : null;
  } catch {
    return null;
  }
}

/** Development builds only: `localStorage['xp-slow']` ms of busy work per frame, to test the switch to stills. */
export function devFrameCost(): number {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return 0;
  try {
    return Number(localStorage.getItem('xp-slow')) || 0;
  } catch {
    return 0;
  }
}

/** Development builds only: puts values on `window` for scripts/ui-check (scroll progress, quality tier). */
export function devExpose(values: Record<string, unknown>): void {
  if (typeof ngDevMode !== 'undefined' && ngDevMode) Object.assign(window, values);
}

/** Colour tokens from src/styles.css, all "R G B" triples except --accent-underline (0 or 1). */
const COLOUR_TOKENS = ['canvas', 'surface', 'surface-2', 'line', 'ink', 'muted', 'accent', 'brand-glow', 'tint', 'headline-accent', 'success', 'warning', 'danger'];
let tokensTyped = false;

/**
 * Sections stop painting their own palette (data-palette → data-xp-palette) and become transparent, so the
 * palette on <html> — set by the page component for the section in the middle of the screen — colours the whole
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
