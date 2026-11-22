import * as THREE from 'three';

const CORAL = 0xff6b5b;

/** A rounded-rectangle outline in the XY plane, centred. */
function outline(width: number, height: number, radius: number): THREE.CatmullRomCurve3 {
  const shape = new THREE.Shape();
  const [w, h, r] = [width / 2, height / 2, radius];
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w, h - r);
  shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w + r, h);
  shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w, -h + r);
  shape.absarc(-w + r, -h + r, r, Math.PI, (3 * Math.PI) / 2, false);
  return new THREE.CatmullRomCurve3(shape.getSpacedPoints(96).map((p) => new THREE.Vector3(p.x, p.y, 0)), true);
}

/** A phone outline with a scan line, held up to the QR code. Sized in QR modules (1 unit = 1 module). */
export class Phone {
  readonly root = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({ color: CORAL });
  private readonly frameGeometry: THREE.TubeGeometry;
  private readonly lineGeometry: THREE.BoxGeometry;
  private readonly line: THREE.Mesh;
  private readonly height: number;

  constructor(width: number, height: number) {
    this.height = height;
    this.frameGeometry = new THREE.TubeGeometry(outline(width, height, width * 0.16), 160, 0.28, 8, true);
    this.lineGeometry = new THREE.BoxGeometry(width * 0.86, 0.22, 0.22);
    this.line = new THREE.Mesh(this.lineGeometry, this.material);
    this.root.add(new THREE.Mesh(this.frameGeometry, this.material), this.line);
  }

  /** `scan` 0–1 moves the scan line from top to bottom; outside that range it's hidden. */
  pose(scan: number): void {
    this.line.visible = scan > 0 && scan < 1;
    this.line.position.y = this.height * (0.4 - 0.8 * scan);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.material.dispose();
    this.frameGeometry.dispose();
    this.lineGeometry.dispose();
  }
}
