import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Tier, TIER_SETTINGS } from './quality';

const FOV = 35;
const CAMERA_Z = 12;
const HALF_FOV_TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** Where the live canvas sits: in front of the page's HTML (clicks pass through) or behind it. */
export type Layer = 'front' | 'back';

/**
 * One renderer, scene and camera for the whole page. A single WebGL context: environment maps and shaders belong to
 * a context, so a second canvas would double GPU memory and start-up work. Live, the canvas is fixed over the
 * viewport and moves in front of or behind the HTML; for stills it renders off-screen and is copied out.
 */
export class Stage {
  readonly canvas = document.createElement('canvas');
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  readonly renderer: THREE.WebGLRenderer;
  private readonly environment: THREE.WebGLRenderTarget;
  /** Drawing area in CSS pixels. */
  width = 1;
  height = 1;

  /** Throws when WebGL is unavailable. */
  constructor(public tier: Tier) {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.camera.position.z = CAMERA_Z;
    this.canvas.setAttribute('aria-hidden', 'true');
  }

  /** Live: fixed over the viewport. 100vh (not the visible height) so phone toolbars showing/hiding don't resize it. */
  attach(parent: HTMLElement, layer: Layer): void {
    Object.assign(this.canvas.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100vh', pointerEvents: 'none' });
    this.setLayer(layer);
    parent.appendChild(this.canvas);
  }

  /** Front sits under the marketing header (z-40) so it still blurs the 3D behind it. */
  setLayer(layer: Layer): void {
    const zIndex = layer === 'front' ? '20' : '-1';
    if (this.canvas.style.zIndex !== zIndex) this.canvas.style.zIndex = zIndex;
  }

  setTier(tier: Tier): void {
    this.tier = tier;
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_SETTINGS[this.tier].maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * The point on the focal plane (z = 0, where every object is placed) that appears at (x, y) CSS px of the drawing
   * area. Objects are sized by scale, not distance: scaling an object and its distance together looks identical.
   */
  planePoint(x: number, y: number, target: THREE.Vector3): THREE.Vector3 {
    const perPixel = this.unitsPerPixel();
    return target.set((x - this.width / 2) * perPixel, (this.height / 2 - y) * perPixel, 0);
  }

  /** World units per CSS px on the focal plane. */
  unitsPerPixel(): number {
    return (2 * CAMERA_Z * HALF_FOV_TAN) / this.height;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  clear(): void {
    this.renderer.clear();
  }

  dispose(): void {
    this.canvas.remove();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // release the context now rather than at garbage collection
  }
}
