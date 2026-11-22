import * as THREE from 'three';
import type { Stage } from './stage';

// Chain geometry (scene units). A link is a "stadium": two straights joined by half circles.
const LINK_COUNT = 5;
const STRAIGHT = 1.0;
const RADIUS = 0.42;
const WIRE = 0.12;
const PITCH = 1.36; // distance between link centres so neighbours interlock
const CYCLE_SECONDS = 6;
const MAX_TILT = 0.14; // ≈ 8° of pointer parallax

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * How compressed the chain is at a moment in the loop: 0 = long chain, 1 = one short glowing link.
 * drift 1.5 s → compress 1.5 s → hold 1.5 s → release 1.5 s. Pure.
 */
export function compressionAt(seconds: number): number {
  const t = seconds % CYCLE_SECONDS;
  if (t < 1.5) return 0;
  if (t < 3) return easeInOutCubic((t - 1.5) / 1.5);
  if (t < 4.5) return 1;
  return 1 - easeInOutCubic((t - 4.5) / 1.5);
}

/**
 * Scale that frames the chain in a box the way the original hero canvas did (camera z = max(10, 14 / aspect) on a
 * box-sized view, fov 35°), for an object on the focal plane `focus` units from the camera. Pure.
 */
export function chainScale(box: { width: number; height: number }, viewHeight: number, focus: number): number {
  return (focus * box.height) / (Math.max(10, 14 / (box.width / box.height)) * viewHeight);
}

/** The chain's link size in its own units: what `set` scales. */
export const LINK_WIDTH = STRAIGHT + 2 * (RADIUS + WIRE);
/** Distance between interlocking links' centres. */
export const LINK_PITCH = PITCH;

/** One chain link: a tube along a stadium in the XY plane, long axis along x, LINK_WIDTH wide. */
export function linkGeometry(): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new Stadium(), 160, WIRE, 20, true);
}

const VIOLET = new THREE.Color(0x8b5cf6);
const VIOLET_GLOW = new THREE.Color(0x6d28d9);
const AMBER = new THREE.Color(0xf5b83d);
const GLOW = new THREE.Color(0xa78bfa);
const scratch = new THREE.Vector3();

/** The Zelqit chain: a long metallic chain that compresses into one short glowing link. */
export class Chain {
  /** Placed on the stage; turned to face the camera so it looks the same anywhere on screen. */
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group(); // posed: rotation, link spacing
  private readonly geometry = linkGeometry();
  private readonly material = new THREE.MeshPhysicalMaterial({
    color: 0x8b5cf6, metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12,
    iridescence: 1, iridescenceIOR: 1.3, emissive: 0x6d28d9, emissiveIntensity: 0,
  });
  private readonly centreMaterial = this.material.clone(); // only the surviving link glows
  private readonly glow = new THREE.PointLight(GLOW, 0, 6);
  private readonly links: THREE.Mesh[];
  private readonly centre = Math.floor(LINK_COUNT / 2);
  private compression = 0;
  private scale = 1;

  constructor() {
    this.links = Array.from({ length: LINK_COUNT }, (_, i) => {
      const mesh = new THREE.Mesh(this.geometry, i === this.centre ? this.centreMaterial : this.material);
      mesh.rotation.x = i % 2 === 0 ? 0 : Math.PI / 2; // alternate planes so links interlock
      this.body.add(mesh);
      return mesh;
    });
    this.body.add(this.glow);
    this.root.add(this.body);
  }

  /**
   * `compression` 0–1 (see compressionAt); `tiltX`/`tiltY` −1…1 pointer parallax; `seconds` drives the slow sway;
   * `spin` turns it about its own vertical axis (radians); `sheen` 0–1 warms the surviving link to amber (Pro).
   */
  pose(seconds: number, compression: number, tiltX: number, tiltY: number, spin = 0, sheen = 0): void {
    this.links.forEach((mesh, i) => {
      const offset = i - this.centre;
      mesh.position.x = offset * PITCH * (1 - compression);
      const scale = offset === 0 ? 1 + 0.15 * compression : 1 - compression;
      mesh.scale.setScalar(Math.max(scale, 0.001));
      mesh.visible = scale > 0.01;
    });
    this.centreMaterial.emissiveIntensity = 0.9 * compression * (1 - 0.65 * sheen); // amber reads as gold metal, not a lamp
    this.centreMaterial.color.lerpColors(VIOLET, AMBER, sheen);
    this.centreMaterial.emissive.lerpColors(VIOLET_GLOW, AMBER, sheen);
    this.glow.color.lerpColors(GLOW, AMBER, sheen);
    this.compression = compression;
    this.updateGlow();
    this.body.rotation.set(0.35 + tiltY * MAX_TILT, -0.55 + Math.sin(seconds * 0.4) * 0.12 + tiltX * MAX_TILT + spin, 0.1);
  }

  /** Centre the chain in `box` (CSS px of the stage's drawing area) at the original hero framing. */
  place(stage: Stage, box: { left: number; top: number; width: number; height: number }): void {
    const centre = stage.planePoint(box.left + box.width / 2, box.top + box.height / 2, scratch);
    this.set(stage, centre, chainScale(box, stage.height, stage.camera.position.z));
  }

  /** Put the chain at a world position and size, facing the camera (so it looks the same anywhere on screen). */
  set(stage: Stage, position: THREE.Vector3, scale: number): void {
    this.scale = scale;
    this.root.position.copy(position);
    this.root.scale.setScalar(Math.max(scale, 1e-4));
    this.root.visible = scale > 1e-3;
    this.root.lookAt(stage.camera.position);
    this.updateGlow();
  }

  /** The glow light scales with the chain: same look at any size (illuminance ∝ intensity / distance²). */
  private updateGlow(): void {
    this.glow.intensity = 8 * this.compression * this.scale ** 2;
    this.glow.distance = 6 * this.scale;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.centreMaterial.dispose();
    this.glow.dispose();
  }
}

const HALF = STRAIGHT / 2;
const PERIMETER = 2 * STRAIGHT + 2 * Math.PI * RADIUS;

/** Closed stadium-shaped path (one chain link) in the XY plane, centred on the origin. */
class Stadium extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super(); // Curve's own constructor is protected
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    let s = (t % 1) * PERIMETER;
    if (s < STRAIGHT) return target.set(-HALF + s, RADIUS, 0); // top, left → right
    s -= STRAIGHT;
    if (s < Math.PI * RADIUS) {
      const a = Math.PI / 2 - s / RADIUS; // right half circle, top → bottom
      return target.set(HALF + RADIUS * Math.cos(a), RADIUS * Math.sin(a), 0);
    }
    s -= Math.PI * RADIUS;
    if (s < STRAIGHT) return target.set(HALF - s, -RADIUS, 0); // bottom, right → left
    s -= STRAIGHT;
    const a = -Math.PI / 2 - s / RADIUS; // left half circle, bottom → top
    return target.set(-HALF + RADIUS * Math.cos(a), RADIUS * Math.sin(a), 0);
  }
}
