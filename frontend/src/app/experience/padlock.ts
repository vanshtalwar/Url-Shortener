import * as THREE from 'three';

const AMBER = 0xf5b83d;
// Padlock units: the body is BODY_W × BODY_H, centred on the origin.
const BODY_W = 3.2;
const BODY_H = 2.6;
const BODY_D = 1.1;
const SHACKLE_R = 1.0; // radius of the shackle's arch (to the tube's centre)
const SHACKLE_LEG = 1.3; // straight legs below the arch
const SHACKLE_TUBE = 0.26;
const DROP = 0.9; // how far the shackle sinks when it snaps shut
export const PADLOCK_HEIGHT = BODY_H + SHACKLE_LEG + SHACKLE_R + SHACKLE_TUBE; // closed, for framing

const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const [w, h, r] = [width / 2, height / 2, radius];
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

/** The shackle: a U (two legs and an arch), open end down, its legs' feet at y = 0. */
function shackleCurve(): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const r = SHACKLE_R;
  path.add(new THREE.LineCurve3(new THREE.Vector3(-r, 0, 0), new THREE.Vector3(-r, SHACKLE_LEG, 0)));
  const arch = new THREE.EllipseCurve(0, SHACKLE_LEG, r, r, Math.PI, 0, true);
  path.add(new THREE.CatmullRomCurve3(arch.getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 0))));
  path.add(new THREE.LineCurve3(new THREE.Vector3(r, SHACKLE_LEG, 0), new THREE.Vector3(r, 0, 0)));
  return path;
}

/**
 * The Protect moment's padlock, in amber metal: the body grows around the link, the shackle drops in from above
 * and snaps shut with a glow.
 */
export class Padlock {
  readonly root = new THREE.Group();
  private readonly material = new THREE.MeshPhysicalMaterial({ color: AMBER, metalness: 1, roughness: 0.28, clearcoat: 0.6, emissive: AMBER, emissiveIntensity: 0 });
  private readonly darkMaterial = new THREE.MeshStandardMaterial({ color: 0x07060b, roughness: 0.6 });
  private readonly bodyGeometry: THREE.ExtrudeGeometry;
  private readonly shackleGeometry: THREE.TubeGeometry;
  private readonly keyholeGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24);
  private readonly slotGeometry = new THREE.BoxGeometry(0.16, 0.5, 0.2);
  private readonly body = new THREE.Group();
  private readonly shackle: THREE.Mesh;

  constructor() {
    this.bodyGeometry = new THREE.ExtrudeGeometry(roundedRect(BODY_W, BODY_H, 0.45), { depth: BODY_D, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4, curveSegments: 8 });
    this.bodyGeometry.translate(0, 0, -BODY_D / 2);
    this.shackleGeometry = new THREE.TubeGeometry(shackleCurve(), 96, SHACKLE_TUBE, 12, false);
    const keyhole = new THREE.Mesh(this.keyholeGeometry, this.darkMaterial);
    keyhole.rotation.x = Math.PI / 2;
    keyhole.position.set(0, 0.1, BODY_D / 2 + 0.1);
    const slot = new THREE.Mesh(this.slotGeometry, this.darkMaterial);
    slot.position.set(0, -0.3, BODY_D / 2 + 0.1);
    this.body.add(new THREE.Mesh(this.bodyGeometry, this.material), keyhole, slot);
    this.shackle = new THREE.Mesh(this.shackleGeometry, this.material);
    this.root.add(this.body, this.shackle);
  }

  /** `assemble` 0–1 grows the body and lowers the shackle into place; `snap` 0–1 shuts it, with a glow. */
  pose(assemble: number, snap: number): void {
    const grow = easeOutBack(clamp01(assemble / 0.7));
    this.body.scale.setScalar(Math.max(grow, 1e-4));
    this.body.position.y = -PADLOCK_HEIGHT / 2 + BODY_H / 2; // whole lock centred on the origin when closed
    const top = this.body.position.y + BODY_H / 2;
    const arrive = clamp01((assemble - 0.3) / 0.7);
    const open = top - 0.25 + DROP; // legs just inside the body, raised
    // Falls in from above as it assembles, then snaps down (with a small bounce).
    this.shackle.position.y = open + (1 - arrive) * (1 - arrive) * 4 - DROP * easeOutBack(clamp01(snap));
    this.shackle.scale.setScalar(Math.max(arrive, 1e-4));
    this.material.emissiveIntensity = Math.sin(Math.PI * clamp01((snap - 0.6) / 0.4)) * 0.6;
    this.root.visible = assemble > 0;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.material.dispose();
    this.darkMaterial.dispose();
    this.bodyGeometry.dispose();
    this.shackleGeometry.dispose();
    this.keyholeGeometry.dispose();
    this.slotGeometry.dispose();
  }
}
