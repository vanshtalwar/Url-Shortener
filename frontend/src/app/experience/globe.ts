import * as THREE from 'three';
import { LAND_MASK, LAND_STEP } from './land-mask';

export const GLOBE_RADIUS = 10;
const MINT = 0x3dd6b5;
const TRAIL = 16; // dots per arc
const DOT = 1.0; // land-dot size per unit of globe scale (points are sized in screen terms, not by the object's scale)
// Where sample clicks come from: latitude, longitude. A trail flies only while its city faces the camera.
const ORIGINS: [number, number][] = [
  [20.6, 78.9], [39.8, -98.6], [54, -2], [51.2, 10.4], [-14.2, -51.9], [36.2, 138.3],
  [9.1, 8.7], [-25.3, 133.8], [23.6, -102.5], [-0.8, 113.9], [-0.1, 37.9], [46.2, 2.2],
];

/** Point on a sphere: longitude 0 faces +z (the camera), y up. */
function onSphere(lat: number, lon: number, radius: number, target = new THREE.Vector3()): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(lat);
  const lambda = THREE.MathUtils.degToRad(lon);
  return target.set(radius * Math.cos(phi) * Math.sin(lambda), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(lambda));
}

/** One position per land cell of the mask (skipping Antarctica, which crowds the pole). */
function landPositions(radius: number): Float32Array {
  const bits = atob(LAND_MASK);
  const columns = 360 / LAND_STEP;
  const points: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < bits.length * 8; i++) {
    if (!((bits.charCodeAt(i >> 3) >> (i & 7)) & 1)) continue;
    const lat = 90 - (Math.floor(i / columns) + 0.5) * LAND_STEP;
    if (lat < -60) continue;
    onSphere(lat, -180 + ((i % columns) + 0.5) * LAND_STEP, radius, p);
    points.push(p.x, p.y, p.z);
  }
  return new Float32Array(points);
}

/** A round dot for the points (they're square without one). */
function dotTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

const scratch = { end: new THREE.Vector3(), point: new THREE.Vector3(), toLocal: new THREE.Matrix4(), instance: new THREE.Matrix4() };

/**
 * A dotted globe (land from world-atlas, see land-mask.ts) on a dark sphere, and mint "click" arcs: comet trails
 * flying from a few countries to a point (the link). Trails rather than tubes because their far end moves.
 */
export class Globe {
  readonly root = new THREE.Group(); // placed and scaled by the journey
  private readonly spin = new THREE.Group(); // turns with time
  private readonly texture = dotTexture();
  private readonly landGeometry = new THREE.BufferGeometry();
  private readonly landMaterial = new THREE.PointsMaterial({ color: MINT, map: this.texture, transparent: true, alphaTest: 0.5 });
  private readonly sphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS * 0.985, 48, 32);
  private readonly sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x141b3d, roughness: 0.85, metalness: 0.1 });
  private readonly dotGeometry = new THREE.SphereGeometry(0.32, 8, 6);
  private readonly dotMaterial = new THREE.MeshBasicMaterial({ color: MINT });
  private readonly trails = new THREE.InstancedMesh(this.dotGeometry, this.dotMaterial, ORIGINS.length * TRAIL);
  private readonly origins = ORIGINS.map(([lat, lon]) => onSphere(lat, lon, GLOBE_RADIUS));
  private readonly curves = ORIGINS.map(() => new THREE.QuadraticBezierCurve3());
  private simple = false;

  constructor() {
    this.landGeometry.setAttribute('position', new THREE.BufferAttribute(landPositions(GLOBE_RADIUS), 3));
    this.spin.add(new THREE.Points(this.landGeometry, this.landMaterial), new THREE.Mesh(this.sphereGeometry, this.sphereMaterial));
    this.spin.rotation.x = 0.35;
    this.trails.frustumCulled = false; // instances move far from the mesh's own bounds
    // The trails ride along with the globe's placement but not its spin.
    this.root.add(this.spin, this.trails);
  }

  /** Phones and slow devices: half the trails, shorter. */
  simplify(on: boolean): void {
    this.simple = on;
  }

  /** `seconds` turns the globe; `arcs` 0–1 fades the trails in; `target` (world) is where they land. */
  pose(seconds: number, arcs: number, target: THREE.Vector3): void {
    this.spin.rotation.y = -1.1 + seconds * 0.12; // starts with Europe, Africa and India facing the camera
    this.landMaterial.size = DOT * this.root.scale.x;
    this.root.updateMatrixWorld(true);
    this.trails.visible = arcs > 0.01;
    if (!this.trails.visible) return;

    // Curves in root space: origins turn with the spin; the target comes in from world space.
    const end = scratch.end.copy(target).applyMatrix4(scratch.toLocal.copy(this.root.matrixWorld).invert());
    this.curves.forEach((curve, a) => {
      curve.v2.copy(end);
      curve.v0.copy(this.origins[a]).applyMatrix4(this.spin.matrix);
      const facing = curve.v0.z > GLOBE_RADIUS * 0.2 && !(this.simple && a % 2); // root-local +z faces the camera
      const length = this.simple ? TRAIL * 0.6 : TRAIL;
      // Control point: halfway, pushed out from the globe so the arc clears its surface.
      curve.v1.addVectors(curve.v0, curve.v2).multiplyScalar(0.5);
      curve.v1.setLength(Math.max(curve.v1.length(), GLOBE_RADIUS) * 1.45);
      const head = (seconds * 0.35 + (a * 7) / ORIGINS.length) % 1.3; // each trail flies, then pauses a moment
      for (let k = 0; k < TRAIL; k++) {
        const t = head - k * 0.028;
        const size = !facing || k >= length || t < 0 || t > 1 ? 0 : (1 - k / length) * arcs;
        curve.getPoint(Math.min(Math.max(t, 0), 1), scratch.point);
        this.trails.setMatrixAt(a * TRAIL + k, scratch.instance.makeScale(size, size, size).setPosition(scratch.point));
      }
    });
    this.trails.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.texture.dispose();
    this.landGeometry.dispose();
    this.landMaterial.dispose();
    this.sphereGeometry.dispose();
    this.sphereMaterial.dispose();
    this.dotGeometry.dispose();
    this.dotMaterial.dispose();
    this.trails.dispose();
  }
}
