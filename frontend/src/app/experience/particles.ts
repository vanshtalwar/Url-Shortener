const SPRITE = 64; // px; each shape is pre-drawn into a SPRITE × SPRITE canvas, then scaled when drawn
const BLURS = [0, 3, 8]; // px at sprite size: sharp (middle distance), soft (far), very soft (near)
const POOL = 80; // particles generated; the tier decides how many are drawn

interface Particle {
  shape: number; // 0 = link loop, 1 = QR square
  depth: number; // 0 near … 1 far
  x: number; // 0–1 across the screen
  y: number; // 0–1 down the screen, before drift and parallax
  phase: number;
  spin: number; // rad/s
}

/** How many particles to draw: by screen area, times the tier's share. Pure. */
export function particleCount(width: number, height: number, share: number): number {
  return Math.round(Math.min(POOL, Math.max(18, (width * height) / 16000)) * share);
}

/**
 * Ambient particles (spec §4.5): tiny link loops and QR squares drifting behind the page, blurred by depth
 * (pre-blurred sprites, no post-processing) and tinted with the current section's accent. A 2D canvas fixed
 * behind the HTML — cheap, and it never needs to come in front of the text like the 3D canvas does. Live mode only.
 */
export class Particles {
  readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly sprites = [drawLoop, drawSquare].map((shape) => BLURS.map((blur) => sprite(shape, blur)));
  private readonly items: Particle[] = Array.from({ length: POOL }, () => ({
    shape: Math.random() < 0.5 ? 0 : 1,
    depth: Math.random(),
    x: Math.random(),
    y: Math.random(),
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
  }));
  private count = 0;
  private width = 1;
  private height = 1;
  private opacity = 0; // fades in at start and out over quiet sections

  /** Throws if the browser has no 2D canvas. */
  constructor() {
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Particles: no 2D canvas');
    this.context = context;
    this.canvas.setAttribute('aria-hidden', 'true');
    // Behind the HTML and behind the 3D canvas's back layer (z −1).
    Object.assign(this.canvas.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100vh', pointerEvents: 'none', zIndex: '-2' });
  }

  resize(width: number, height: number, pixelRatio: number, count: number): void {
    this.width = width;
    this.height = height;
    this.count = count;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
  }

  /**
   * `tint` is an "R G B" triple; `visible` 0 or 1 is faded towards. Nothing is drawn inside `keepClear` (CSS px,
   * e.g. a QR code's quiet zone, which must stay clean to scan).
   */
  draw(seconds: number, scrollY: number, tint: string, visible: number, keepClear?: DOMRect | null): void {
    const ctx = this.context;
    this.opacity += (visible - this.opacity) * 0.06;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.opacity < 0.01) return;

    const ratio = this.canvas.width / this.width;
    const span = this.height + 120; // particles wrap around just outside the screen
    for (let i = 0; i < this.count; i++) {
      const p = this.items[i];
      const size = 34 - 22 * p.depth; // CSS px; near ones are bigger…
      const parallax = 0.45 - 0.35 * p.depth; // …and move faster with the page (the page itself moves at 1)
      const drift = 16 - 10 * p.depth; // px/s upwards
      const x = p.x * this.width + Math.sin(seconds * 0.3 + p.phase) * 14;
      const y = mod(p.y * span - seconds * drift - scrollY * parallax, span) - 60;
      if (keepClear && x > keepClear.left - size && x < keepClear.right + size && y > keepClear.top - size && y < keepClear.bottom + size) continue;
      const blur = p.depth < 0.2 ? 2 : p.depth > 0.7 ? 1 : 0; // in focus in the middle distance
      ctx.globalAlpha = (0.55 - 0.3 * p.depth) * this.opacity;
      ctx.setTransform(ratio, 0, 0, ratio, x * ratio, y * ratio);
      ctx.rotate(p.phase + seconds * p.spin);
      ctx.drawImage(this.sprites[p.shape][blur], -size / 2, -size / 2, size, size);
    }
    // The sprites are white: colour everything drawn this frame in one pass.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${tint})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  dispose(): void {
    this.canvas.remove();
    this.canvas.width = this.canvas.height = 0; // free the bitmap now
  }
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** A white shape centred in a SPRITE-sized canvas, blurred by `blur` px. */
function sprite(shape: (ctx: CanvasRenderingContext2D) => void, blur: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  if (blur) {
    // Blur through the shadow of a copy drawn off to the side: works everywhere (ctx.filter doesn't in older Safari).
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = SPRITE * 2;
    ctx.translate(-SPRITE * 2, 0);
  }
  ctx.translate(SPRITE / 2, SPRITE / 2);
  shape(ctx);
  return canvas;
}

/** One chain link seen from above: a stadium outline. */
function drawLoop(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.arc(9, 0, 8, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-9, 8);
  ctx.arc(-9, 0, 8, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.stroke();
}

/** A QR finder square: a ring with a dot. */
function drawSquare(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 5;
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.fillRect(-4, -4, 8, 8);
}
