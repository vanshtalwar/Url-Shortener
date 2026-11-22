import * as THREE from 'three';
import { LINK_PITCH, linkGeometry } from './chain';

const MAX_LINKS = 14;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const scratch = { at: new THREE.Vector3(), tangent: new THREE.Vector3(), q: new THREE.Quaternion(), turn: new THREE.Quaternion(), m: new THREE.Matrix4(), s: new THREE.Vector3() };

/**
 * A chain of interlocking links laid along a curve, growing from its start: the A/B moment's chains fanning out
 * from the link to its destinations. World space (the curve's points are world positions).
 */
export class LinkChain {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry = linkGeometry();
  private readonly curve = new THREE.QuadraticBezierCurve3();

  constructor(material: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(this.geometry, material, MAX_LINKS);
    this.mesh.frustumCulled = false; // instances span far beyond the mesh's own bounds
  }

  /**
   * Lay links of `scale` from `start` to `end`, bowed through `control`; `grow` 0–1 reveals them in order from the
   * start. Links alternate planes about the curve so neighbours interlock.
   */
  pose(start: THREE.Vector3, control: THREE.Vector3, end: THREE.Vector3, scale: number, grow: number): void {
    this.curve.v0.copy(start);
    this.curve.v1.copy(control);
    this.curve.v2.copy(end);
    this.curve.updateArcLengths(); // the points moved: the cached lengths behind getPointAt are stale
    const count = Math.min(MAX_LINKS, Math.max(1, Math.round(this.curve.getLength() / (LINK_PITCH * scale))));
    this.mesh.visible = grow > 0 && scale > 1e-4;
    for (let i = 0; i < MAX_LINKS; i++) {
      // Each link pops in over its share of `grow`, so the chain extends link by link.
      const shown = i < count ? Math.min(1, Math.max(0, grow * count - i)) : 0;
      const t = (i + 0.5) / count;
      this.curve.getPointAt(Math.min(t, 1), scratch.at);
      this.curve.getTangentAt(Math.min(t, 1), scratch.tangent);
      scratch.q.setFromUnitVectors(X_AXIS, scratch.tangent);
      if (i % 2) scratch.q.premultiply(scratch.turn.setFromAxisAngle(scratch.tangent, Math.PI / 2));
      this.mesh.setMatrixAt(i, scratch.m.compose(scratch.at, scratch.q, scratch.s.setScalar(Math.max(scale * shown, 1e-5))));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
  }
}
