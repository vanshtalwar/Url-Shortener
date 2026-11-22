import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import type * as THREE from 'three';

// Chain geometry (scene units). A link is a "stadium": two straights joined by half circles.
const LINK_COUNT = 5;
const STRAIGHT = 1.0;
const RADIUS = 0.42;
const WIRE = 0.12;
const PITCH = 1.36; // distance between link centres so neighbours interlock
const CYCLE_SECONDS = 6;
const MAX_TILT = 0.14; // ≈ 8° of mouse parallax

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * How compressed the chain is at a moment in the loop: 0 = long chain, 1 = one short glowing link.
 * drift 1.5 s → compress 1.5 s → hold 1.5 s → release 1.5 s. Pure.
 */
function compressionAt(seconds: number): number {
  const t = seconds % CYCLE_SECONDS;
  if (t < 1.5) return 0;
  if (t < 3) return easeInOutCubic((t - 1.5) / 1.5);
  if (t < 4.5) return 1;
  return 1 - easeInOutCubic((t - 4.5) / 1.5);
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Landing-page hero: a long metallic chain that compresses into one short glowing link.
 * three.js is imported dynamically (own chunk, never in `main`). Pauses off-screen / in background tabs;
 * a single still frame with prefers-reduced-motion; a static SVG when WebGL is unavailable.
 */
@Component({
  selector: 'app-hero-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <canvas #canvas class="block h-full w-full" [class.hidden]="mode !== 'webgl'" aria-hidden="true"></canvas>
    <!-- Shown while three.js loads (and permanently without WebGL), so the hero is never empty. -->
    <svg *ngIf="mode !== 'webgl'" viewBox="0 0 320 120" class="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="hero-chain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgb(var(--brand-glow))" />
          <stop offset="1" stop-color="rgb(var(--brand-to))" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#hero-chain)" stroke-width="9" stroke-linecap="round">
        <rect x="20" y="40" width="90" height="40" rx="20" />
        <rect x="90" y="48" width="70" height="24" rx="12" opacity="0.7" />
        <rect x="140" y="40" width="90" height="40" rx="20" />
        <rect x="210" y="48" width="70" height="24" rx="12" opacity="0.7" />
      </g>
    </svg>
  `,
})
export class HeroSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  mode: 'loading' | 'webgl' | 'fallback' = 'loading';

  private destroyed = false;
  private cleanup: (() => void)[] = [];

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (!webglAvailable()) return this.showFallback();
    // Everything per-frame runs outside Angular so the render loop never triggers change detection.
    // Wait until the browser is idle after first paint, so three.js doesn't compete with the page loading.
    this.zone.runOutsideAngular(() => {
      const begin = () => this.start().catch(() => this.zone.run(() => this.showFallback()));
      if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(begin, { timeout: 3000 });
        this.cleanup.push(() => cancelIdleCallback(id));
      } else {
        const id = setTimeout(begin, 1500);
        this.cleanup.push(() => clearTimeout(id));
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cleanup.forEach((fn) => fn());
  }

  private showFallback(): void {
    this.mode = 'fallback';
    this.cdr.markForCheck();
  }

  private async start(): Promise<void> {
    const [T, { RoomEnvironment }] = await Promise.all([import('three'), import('three/examples/jsm/environments/RoomEnvironment.js')]);
    if (this.destroyed) return;
    const canvas = this.canvasRef.nativeElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.outputColorSpace = T.SRGBColorSpace;

    const scene = new T.Scene();
    const pmrem = new T.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environment.texture;
    const camera = new T.PerspectiveCamera(35, 1, 0.1, 100);

    const geometry = new T.TubeGeometry(stadiumCurve(T), 160, WIRE, 20, true);
    const chainMaterial = new T.MeshPhysicalMaterial({
      color: 0x8b5cf6, metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12,
      iridescence: 1, iridescenceIOR: 1.3, emissive: 0x6d28d9, emissiveIntensity: 0,
    });
    const centreMaterial = chainMaterial.clone(); // only the surviving link glows

    const group = new T.Group();
    const centre = Math.floor(LINK_COUNT / 2);
    const links = Array.from({ length: LINK_COUNT }, (_, i) => {
      const mesh = new T.Mesh(geometry, i === centre ? centreMaterial : chainMaterial);
      mesh.rotation.x = i % 2 === 0 ? 0 : Math.PI / 2; // alternate planes so links interlock
      group.add(mesh);
      return mesh;
    });
    const glow = new T.PointLight(0xa78bfa, 0, 6);
    group.add(glow);
    scene.add(group);

    // Parallax target from the pointer, eased towards each frame.
    const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onPointer = (e: PointerEvent) => {
      tilt.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      tilt.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const draw = (seconds: number) => {
      const c = reducedMotion ? 0 : compressionAt(seconds);
      links.forEach((mesh, i) => {
        const offset = i - centre;
        mesh.position.x = offset * PITCH * (1 - c);
        const scale = offset === 0 ? 1 + 0.15 * c : 1 - c;
        mesh.scale.setScalar(Math.max(scale, 0.001));
        mesh.visible = scale > 0.01;
      });
      centreMaterial.emissiveIntensity = 0.9 * c;
      glow.intensity = 8 * c;
      tilt.x += (tilt.targetX - tilt.x) * 0.05;
      tilt.y += (tilt.targetY - tilt.y) * 0.05;
      group.rotation.set(0.35 + tilt.y * MAX_TILT, -0.55 + Math.sin(seconds * 0.4) * 0.12 + tilt.x * MAX_TILT, 0.1);
      renderer.render(scene, camera);
    };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement ?? canvas;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the whole chain in view; the turned chain's near end looks larger, so leave extra room.
      camera.position.set(0, 0, Math.max(10, 14 / camera.aspect));
      camera.updateProjectionMatrix();
      if (reducedMotion) draw(0);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement ?? canvas);
    resize();

    // Only animate while on screen and the tab is visible.
    let onScreen = true;
    const clock = new T.Clock();
    const update = () => {
      const run = !reducedMotion && onScreen && !document.hidden;
      renderer.setAnimationLoop(run ? () => draw(clock.getElapsedTime()) : null);
    };
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    visibility.observe(canvas);
    document.addEventListener('visibilitychange', update);
    if (!reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });
    draw(0);
    update();
    this.zone.run(() => {
      this.mode = 'webgl';
      this.cdr.markForCheck();
    });

    this.cleanup.push(() => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pointermove', onPointer);
      geometry.dispose();
      chainMaterial.dispose();
      centreMaterial.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    });
  }
}

/** Closed stadium-shaped path (one chain link) in the XY plane, centred on the origin. */
function stadiumCurve(T: typeof THREE): THREE.Curve<THREE.Vector3> {
  const half = STRAIGHT / 2;
  const perimeter = 2 * STRAIGHT + 2 * Math.PI * RADIUS;
  class Stadium extends T.Curve<THREE.Vector3> {
    constructor() {
      super(); // Curve's own constructor is protected
    }

    override getPoint(t: number, target = new T.Vector3()): THREE.Vector3 {
      let s = (t % 1) * perimeter;
      if (s < STRAIGHT) return target.set(-half + s, RADIUS, 0); // top, left → right
      s -= STRAIGHT;
      if (s < Math.PI * RADIUS) {
        const a = Math.PI / 2 - s / RADIUS; // right half circle, top → bottom
        return target.set(half + RADIUS * Math.cos(a), RADIUS * Math.sin(a), 0);
      }
      s -= Math.PI * RADIUS;
      if (s < STRAIGHT) return target.set(half - s, -RADIUS, 0); // bottom, right → left
      s -= STRAIGHT;
      const a = -Math.PI / 2 - s / RADIUS; // left half circle, bottom → top
      return target.set(-half + RADIUS * Math.cos(a), RADIUS * Math.sin(a), 0);
    }
  }
  return new Stadium();
}
