// The landing page's cursor: a dot enclosed in a jiggly 3D ring (see startCursor).

const RING = 40; // px
const DOT = 6;
/** Where the text cursor shows instead (to place the caret and select text). */
const FIELDS = 'input:not([type=checkbox], [type=radio], [type=range], [type=color], [type=file], [type=submit], [type=button], [type=reset]), textarea, [contenteditable]:not([contenteditable=false])';
/** Where the ring grows. */
const INTERACTIVE = 'a[href], button:not(:disabled), [role=button], summary, label, select, input[type=checkbox], input[type=radio], input[type=submit], input[type=button]';

// Injected while the cursor runs, so it adds nothing to the global CSS. Colours come from the section palette on
// <html>: the ring's rim takes the section accent (--tint), the dot is ink edged with the page colour, so both read
// on the dark and the cream sections. The ring is shaded like a glass bead: a highlight top left, shade bottom right,
// a rim and a soft drop shadow; what's under it stays sharp (no blur), so a button's label still reads.
const CSS = `
html.xp-cursor, html.xp-cursor * { cursor: none !important; }
html.xp-cursor :is(${FIELDS}) { cursor: text !important; }
.xp-cursor-ring, .xp-cursor-dot {
  position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; border-radius: 50%;
  opacity: 0; transition: opacity 0.2s; will-change: transform;
}
html.xp-cursor:not(.xp-cursor-text) :is(.xp-cursor-ring, .xp-cursor-dot) { opacity: 1; }
.xp-cursor-ring {
  width: ${RING}px; height: ${RING}px; margin: ${-RING / 2}px 0 0 ${-RING / 2}px;
  background:
    radial-gradient(circle at 34% 28%, rgb(255 255 255 / 0.65), rgb(255 255 255 / 0) 30%),
    radial-gradient(circle, rgb(var(--tint) / 0.05) 50%, rgb(var(--tint) / 0.45) 69%, rgb(var(--tint) / 0.12) 100%);
  box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.45), inset -4px -6px 10px rgb(0 0 0 / 0.3),
    inset 3px 4px 8px rgb(255 255 255 / 0.2), 0 10px 20px -6px rgb(0 0 0 / 0.45);
  backdrop-filter: saturate(1.6);
}
.xp-cursor-dot {
  width: ${DOT}px; height: ${DOT}px; margin: ${-DOT / 2}px 0 0 ${-DOT / 2}px;
  background: rgb(var(--ink)); box-shadow: 0 0 0 1.5px rgb(var(--canvas) / 0.7);
}
`;

/**
 * The landing page's cursor, for a mouse: a small dot at the pointer, enclosed in a glassy 3D ring that follows on a
 * spring — it trails, stretches along its path, overshoots and wobbles to rest; it grows over links and buttons and
 * squashes while pressed. It replaces the system cursor on the whole page except in text fields, where the text
 * cursor shows instead. Not on touch screens, nor with reduced motion (the system cursor stays). Call it outside
 * Angular: the frame loop runs only while the ring is moving. Returns a stop function.
 */
export function startCursor(): () => void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined;

  const root = document.documentElement;
  const style = document.createElement('style');
  style.textContent = CSS;
  const [ring, dot] = ['xp-cursor-ring', 'xp-cursor-dot'].map((name) => {
    const element = document.createElement('div');
    element.className = name;
    element.setAttribute('aria-hidden', 'true');
    return element;
  });
  document.head.appendChild(style);
  document.body.append(ring, dot);

  const mouse = { x: 0, y: 0 };
  const at = { x: 0, y: 0, vx: 0, vy: 0 }; // the ring's centre (px) and velocity (px/s)
  const size = { value: 1, velocity: 0, target: 1 };
  let hovering = false;
  let pressed = false;
  let frame = 0;
  let last = 0;

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    // Springs, under-damped: the ring trails the pointer, overshoots it and wobbles to rest; its size bounces.
    at.vx += (200 * (mouse.x - at.x) - 14 * at.vx) * dt;
    at.vy += (200 * (mouse.y - at.y) - 14 * at.vy) * dt;
    at.x += at.vx * dt;
    at.y += at.vy * dt;
    size.velocity += (320 * (size.target - size.value) - 16 * size.velocity) * dt;
    size.value += size.velocity * dt;
    // Jelly: longer along its motion, thinner across it. Turned there and back, so the highlight stays top left.
    const speed = Math.hypot(at.vx, at.vy);
    const stretch = Math.min(0.35, speed / 4000);
    const angle = Math.atan2(at.vy, at.vx);
    ring.style.transform = `translate(${at.x}px, ${at.y}px) rotate(${angle}rad) scale(${size.value * (1 + stretch)}, ${size.value * (1 - stretch / 2)}) rotate(${-angle}rad)`;
    const resting = speed < 2 && Math.hypot(mouse.x - at.x, mouse.y - at.y) < 0.2 && Math.abs(size.target - size.value) < 0.002 && Math.abs(size.velocity) < 0.02;
    frame = resting ? 0 : requestAnimationFrame(tick);
  };
  const wake = () => {
    size.target = pressed ? 0.75 : hovering ? 1.6 : 1;
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!root.classList.contains('xp-cursor')) {
      // Appears (or comes back into the window) at the pointer, rather than flying in from where it was.
      Object.assign(at, { x: mouse.x, y: mouse.y, vx: 0, vy: 0 });
      root.classList.add('xp-cursor');
    }
    const target = e.target instanceof Element ? e.target : null;
    root.classList.toggle('xp-cursor-text', Boolean(target?.closest(FIELDS)));
    hovering = Boolean(target?.closest(INTERACTIVE));
    dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`; // at once: the dot is the exact pointer
    wake();
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pressed = true;
    wake();
  };
  const onUp = () => {
    pressed = false;
    wake();
  };
  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) root.classList.remove('xp-cursor'); // out of the window: the system cursor takes over
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('mouseout', onOut, { passive: true });

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    document.removeEventListener('mouseout', onOut);
    root.classList.remove('xp-cursor', 'xp-cursor-text');
    ring.remove();
    dot.remove();
    style.remove();
  };
}
