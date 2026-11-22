import * as THREE from 'three';
import { Chain, chainScale, compressionAt, LINK_WIDTH } from './chain';
import { Globe, GLOBE_RADIUS } from './globe';
import { barSlots, qrSlots, Slot } from './layouts';
import { LinkChain } from './link-chain';
import { Padlock, PADLOCK_HEIGHT } from './padlock';
import { Phone } from './phone';
import type { Tier } from './quality';
import type { Layer, Stage } from './stage';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Moment = 'hero' | 'qr' | 'bars' | 'globe' | 'split' | 'lock' | 'pricing' | 'cta';

/** Scroll progress 0–1 through each part of the journey: all 0 at the top of the page, all 1 past it. */
export interface Progress {
  toShare: number; // hero → QR section
  share: number; // QR moment (pinned): burst, assemble, scan, then hold the finished code
  toKnow: number; // QR → bar chart section: cubes fall
  know: number; // bar chart moment (pinned): bars rise, link lands
  toWhere: number; // bar chart → globe (scrubbed): bars sink, globe rises, link orbits
  toTest: number; // globe → A/B section: the link leaves its orbit
  test: number; // A/B moment (pinned): two chains fan out from the link to its destinations
  toProtect: number; // A/B → padlock section: the chains merge back into the link
  protect: number; // padlock moment (pinned): a padlock assembles around the link and snaps shut
  toPricing: number; // padlock → pricing teaser (scrubbed): the link comes out amber and settles above Pro
  toCta: number; // pricing → final CTA: the link spins once and centres
}

const BAR_VALUES = [34, 48, 42, 63, 71, 88, 104]; // same shape as the bars' SVG stand-in on the page
const CUBE = 0.9; // cube size in module units: the gaps make them read as cubes in flight and in the bars
const MODULE = 1.04; // settled into the QR code they overlap a hair: no seams, solid corner squares for scanners
const GLOBE_SPAN = GLOBE_RADIUS * 3.2; // the globe plus the link's orbit
const LOCK_SPAN = PADLOCK_HEIGHT * 1.15;
const QR_MARGIN = 8; // modules around the code: a 4-module quiet zone so it scans
// Cube colours: dark on the cream QR section (so the code scans), mint as bars on deep violet.
const INK = new THREE.Color(0x1b1826);
const MINT = new THREE.Color(0x3dd6b5);
const CORAL = new THREE.Color(0xff6b5b);
const IDENTITY = new THREE.Quaternion();
const SPLIT_WEIGHTS = [0.6, 0.4]; // the sample split on the page: link sizes follow the weights
const SPLIT_ENDS = [0.24, 0.76]; // where the two chains end, as fractions of the A/B box height (right edge)

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** Progress of `t` through [from, to], clamped to 0–1. */
const range = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t * t;

/** Where a formation sits on screen: world = position + rotation · (local × scale). */
class Frame {
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  scale = 1;

  apply(local: Slot, target: THREE.Vector3): THREE.Vector3 {
    return target.set(local.x, local.y, local.z).multiplyScalar(this.scale).applyQuaternion(this.rotation).add(this.position);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const scratch = {
  m: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  r: new THREE.Quaternion(),
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  s: new THREE.Vector3(),
};

/**
 * Fit a formation of `width` × `height` units into `box` (CSS px), centred and facing the camera, then turned by
 * `turn` (its own angle, e.g. a 3/4 view).
 */
function fit(stage: Stage, box: Box, frame: Frame, width: number, height: number, turn?: THREE.Quaternion): void {
  stage.planePoint(box.left + box.width / 2, box.top + box.height / 2, frame.position);
  frame.scale = Math.min(box.width / width, box.height / height) * stage.unitsPerPixel();
  frame.rotation.setFromRotationMatrix(scratch.m.lookAt(stage.camera.position, frame.position, UP));
  if (turn) frame.rotation.multiply(turn);
}

interface Cube {
  qr: Slot;
  bar: Slot;
  floor: Slot; // where it lands between the QR and the bars
  burst: Slot; // where the burst throws it, around the QR's centre
  tumble: THREE.Quaternion; // its orientation mid-burst / on the floor
  delay: number; // 0–1 stagger
}

/**
 * The landing's travelling object (prompts/zelqit-frontend.md §4.5): the chain link → QR code cubes → bar chart →
 * globe, with the link carried through. Every pose is a function of scroll progress and the anchors' boxes, so the
 * same code draws the live, scrubbed journey and each section's still frame.
 */
export class Journey {
  readonly chain = new Chain();
  private readonly qrSize: number;
  private readonly cubes: Cube[];
  private readonly cubeGeometry = new THREE.BoxGeometry(1, 1, 1); // sized per instance: CUBE in flight, MODULE in the code
  // Low reflection keeps the QR modules properly dark (~40/255 rather than mid-grey) so the code scans reliably.
  private readonly cubeMaterial = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5, metalness: 0.1, envMapIntensity: 0.35, emissive: CORAL, emissiveIntensity: 0 });
  private readonly cubeMesh: THREE.InstancedMesh;
  private readonly phone: Phone;
  private readonly globe = new Globe();
  private readonly barTop: Slot; // top centre of the tallest bar, where the link rests
  private readonly floorY: number; // bars are centred on their middle; this is their base
  private readonly barsSize: { width: number; height: number };
  private readonly frames = { qr: new Frame(), bars: new Frame(), globe: new Frame(), lock: new Frame() };
  private readonly splitMaterial = new THREE.MeshPhysicalMaterial({ color: CORAL, metalness: 1, roughness: 0.25, clearcoat: 1 });
  private readonly splitChains = SPLIT_WEIGHTS.map(() => new LinkChain(this.splitMaterial));
  private readonly dotGeometry = new THREE.SphereGeometry(0.5, 24, 16);
  private readonly dots = SPLIT_WEIGHTS.map(() => new THREE.Mesh(this.dotGeometry, this.splitMaterial));
  private readonly padlock = new Padlock();
  private readonly barsTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, -0.5, 0));

  /** `qrText` is what the QR code really encodes. */
  constructor(stage: Stage, qrText: string) {
    const qr = qrSlots(qrText);
    this.qrSize = qr.size;
    // Left-hand modules build the left-hand bars, so the regrouping reads as one motion.
    const bySide = (a: Slot, b: Slot) => a.x - b.x || a.y - b.y;
    const modules = [...qr.slots].sort(bySide);
    const bars = barSlots(modules.length, BAR_VALUES).sort(bySide);
    const half = qr.size / 2;
    this.cubes = modules.map((module, i) => {
      const angle = Math.random() * Math.PI * 2;
      const reach = half * (0.7 + Math.random() * 0.9);
      return {
        qr: module,
        bar: bars[i],
        floor: { x: bars[i].x + (Math.random() - 0.5) * 3, y: 0.5, z: (Math.random() - 0.5) * 7 },
        burst: { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, z: (Math.random() - 0.5) * half },
        tumble: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
        delay: Math.hypot(module.x, module.y) / (half * Math.SQRT2), // the centre assembles first
      };
    });

    // Centre the chart on its middle so it sits in the middle of its box.
    const tallest = Math.max(...bars.map((b) => b.y)) + 0.5;
    for (const slot of [...bars, ...this.cubes.map((cube) => cube.floor)]) slot.y -= tallest / 2;
    this.floorY = -tallest / 2;
    const topY = Math.max(...bars.map((b) => b.y));
    const top = bars.filter((b) => b.y === topY);
    this.barTop = { x: top.reduce((sum, b) => sum + b.x, 0) / top.length, y: tallest / 2, z: top.reduce((sum, b) => sum + b.z, 0) / top.length };
    const xs = bars.map((b) => b.x);
    this.barsSize = { width: Math.max(...xs) - Math.min(...xs) + 6, height: tallest + 6 };

    this.cubeMesh = new THREE.InstancedMesh(this.cubeGeometry, this.cubeMaterial, this.cubes.length);
    this.cubeMesh.frustumCulled = false; // instances travel far from the mesh's own bounds
    this.phone = new Phone(qr.size * 0.55, qr.size * 1.1);
    stage.scene.add(this.chain.root, this.cubeMesh, this.phone.root, this.globe.root, this.padlock.root, ...this.dots, ...this.splitChains.map((c) => c.mesh));
  }

  /** Lighter detail for phones and slow devices (the stage's tier). */
  setTier(tier: Tier): void {
    this.globe.simplify(tier !== 'high');
  }

  /** Live: pose everything for this scroll position. `boxes`: the anchors' current rectangles on screen. */
  update(stage: Stage, p: Progress, boxes: Record<Moment, Box>, seconds: number, tiltX: number, tiltY: number): Layer {
    const { qr, bars, globe, lock } = this.frames;
    fit(stage, boxes.qr, qr, this.qrSize + QR_MARGIN, this.qrSize + QR_MARGIN);
    fit(stage, boxes.bars, bars, this.barsSize.width, this.barsSize.height, this.barsTurn);
    fit(stage, boxes.globe, globe, GLOBE_SPAN, GLOBE_SPAN);
    fit(stage, boxes.lock, lock, LOCK_SPAN, LOCK_SPAN);
    const perPixel = stage.unitsPerPixel();

    // --- the link --------------------------------------------------------------------------------
    const chain = this.chain;
    const sheen = p.toCta > 0 ? 1 : ease(range(p.toPricing, 0.4, 1)); // turns amber as it reaches Pro
    const spin = Math.PI * 2 * ease(range(p.toCta, 0.2, 1)); // one full turn into the CTA
    chain.pose(seconds, Math.max(compressionAt(seconds), ease(range(p.toShare, 0, 0.3))), tiltX, tiltY, spin, sheen);
    const hero = boxes.hero;
    const heroScale = chainScale(hero, stage.height, stage.camera.position.z);
    const heroAt = stage.planePoint(hero.left + hero.width / 2, hero.top + hero.height / 2, scratch.a);
    const qrLinkScale = (boxes.qr.height * 0.3 * perPixel) / LINK_WIDTH;
    if (p.share === 0) {
      // Rises out of the hero and drifts to the QR's centre.
      const u = ease(range(p.toShare, 0.15, 1));
      const at = scratch.b.lerpVectors(heroAt, qr.position, u);
      at.y += Math.sin(Math.PI * u) * stage.height * 0.12 * perPixel;
      chain.set(stage, at, THREE.MathUtils.lerp(heroScale, qrLinkScale, u));
    } else if (p.know < 0.55) {
      chain.set(stage, qr.position, qrLinkScale * (1 - easeOut(range(p.share, 0, 0.18)))); // shrinks into the burst
    } else if (p.toWhere === 0) {
      // Drops onto the tallest bar.
      const drop = 1 - easeOut(range(p.know, 0.6, 0.9));
      const at = bars.apply({ x: this.barTop.x, y: this.barTop.y + 1.3 + 7 * drop, z: this.barTop.z }, scratch.b);
      chain.set(stage, at, this.linkOnBars() * easeOut(range(p.know, 0.55, 0.7)));
    } else if (p.toTest === 0) {
      // Flies from the bar to its orbit around the globe.
      const u = ease(range(p.toWhere, 0.15, 0.85));
      const from = bars.apply({ x: this.barTop.x, y: this.barTop.y + 1.3, z: this.barTop.z }, scratch.a);
      const to = this.orbit(seconds, scratch.b);
      chain.set(stage, from.lerp(to, u), THREE.MathUtils.lerp(this.linkOnBars(), this.linkAtGlobe(), u));
    } else if (p.test === 0) {
      // Leaves its orbit for the A/B section.
      const u = ease(range(p.toTest, 0.1, 1));
      const from = this.orbit(seconds, scratch.a);
      const splitScale = this.splitStation(stage, boxes.split, scratch.b);
      chain.set(stage, from.lerp(scratch.b, u), THREE.MathUtils.lerp(this.linkAtGlobe(), splitScale, u));
    } else if (p.toProtect === 0) {
      chain.set(stage, scratch.a, this.splitStation(stage, boxes.split, scratch.a));
    } else if (p.protect === 0) {
      // To the padlock section, pulling its chains back in.
      const u = ease(range(p.toProtect, 0.1, 1));
      const splitScale = this.splitStation(stage, boxes.split, scratch.a);
      const inLock = this.lockStation(scratch.b);
      chain.set(stage, scratch.a.lerp(scratch.b, u), THREE.MathUtils.lerp(splitScale, inLock, u));
    } else if (p.toPricing === 0) {
      // Inside the padlock while it assembles around it.
      chain.set(stage, scratch.a, this.lockStation(scratch.a) * (1 - 0.4 * ease(range(p.protect, 0, 0.5))));
    } else if (p.toCta === 0) {
      // Out of the opening padlock, amber, settling above the Pro card.
      const u = ease(range(p.toPricing, 0.15, 1));
      const inLock = this.lockStation(scratch.a) * 0.6;
      const pricingScale = this.stationIn(stage, boxes.pricing, 0.5, 0.5, Math.min(boxes.pricing.width * 0.7, boxes.pricing.height * 1.5), scratch.b);
      chain.set(stage, scratch.a.lerp(scratch.b, u), THREE.MathUtils.lerp(inLock, pricingScale, u));
    } else {
      // Spins once on its way down to the CTA, and centres there.
      const u = ease(range(p.toCta, 0, 1));
      const pricingScale = this.stationIn(stage, boxes.pricing, 0.5, 0.5, Math.min(boxes.pricing.width * 0.7, boxes.pricing.height * 1.5), scratch.a);
      const ctaScale = this.stationIn(stage, boxes.cta, 0.5, 0.5, Math.min(boxes.cta.width, boxes.cta.height) * 0.9, scratch.b);
      chain.set(stage, scratch.a.lerp(scratch.b, u), THREE.MathUtils.lerp(pricingScale, ctaScale, u));
    }

    // --- the cubes: QR code → floor → bars → sink --------------------------------------------------
    const visible = p.share > 0.02 && p.toWhere < 0.55;
    this.cubeMesh.visible = visible;
    if (visible) this.poseCubes(p, qr, bars);
    this.cubeMaterial.emissiveIntensity = Math.sin(Math.PI * range(p.share, 0.76, 0.86)) * 0.55; // "scanned" flash
    this.cubeMaterial.color.lerpColors(INK, MINT, range(p.toKnow, 0.3, 1));

    // --- the phone scanning the QR -------------------------------------------------------------------
    const phoneIn = easeOut(range(p.share, 0.62, 0.7));
    const phoneOut = easeIn(range(p.share, 0.8, 0.88)); // then the finished code holds still: scannable
    this.phone.root.visible = phoneIn > 0 && phoneOut < 1 && p.toKnow === 0;
    if (this.phone.root.visible) {
      const slide = this.qrSize * 1.4 * (1 - phoneIn + phoneOut);
      qr.apply({ x: slide, y: 0, z: 3 }, this.phone.root.position);
      this.phone.root.quaternion.copy(qr.rotation);
      this.phone.root.scale.setScalar(qr.scale);
      this.phone.pose(range(p.share, 0.7, 0.8));
    }

    // --- the globe -------------------------------------------------------------------------------------
    const rise = easeOut(range(p.toWhere, 0.3, 0.9)) * (1 - ease(range(p.toTest, 0.3, 0.8))); // and shrinks away after
    this.globe.root.visible = rise > 0;
    if (rise > 0) {
      this.globe.root.position.copy(globe.position).addScaledVector(UP, -(1 - rise) * GLOBE_RADIUS * globe.scale * 1.5);
      this.globe.root.quaternion.copy(globe.rotation);
      this.globe.root.scale.setScalar(globe.scale * rise);
      this.globe.pose(seconds, range(p.toWhere, 0.75, 1) * (1 - range(p.toTest, 0, 0.3)), chain.root.position);
    }

    // --- the A/B chains: fan out to the destinations, then merge back --------------------------------------
    const grow = p.toProtect > 0 ? 1 - ease(range(p.toProtect, 0, 0.5)) : ease(range(p.test, 0.08, 0.6));
    this.poseSplit(stage, boxes.split, chain.root.position, this.splitStation(stage, boxes.split, scratch.a), p.test > 0 ? grow : 0);

    // --- the padlock: assembles and snaps shut around the link, then opens away as it leaves ----------------
    const assemble = ease(range(p.protect, 0, 0.55));
    const leave = 1 - easeIn(range(p.toPricing, 0, 0.45));
    this.padlock.pose(assemble * leave, range(p.protect, 0.55, 0.8) * (1 - range(p.toPricing, 0, 0.2)));
    this.padlock.root.position.copy(lock.position);
    this.padlock.root.quaternion.copy(lock.rotation);
    this.padlock.root.scale.setScalar(lock.scale);

    // Behind the giant headline while it drifts from the hero to the QR code, in front of the page otherwise.
    return p.toShare > 0.35 && p.toShare < 0.85 && p.share === 0 ? 'back' : 'front';
  }

  /** Still: one moment's end pose, framed in `box` (the stage is sized to the box). */
  still(stage: Stage, moment: Moment, box: Box): void {
    const { qr, bars, globe, lock } = this.frames;
    this.cubeMesh.visible = moment === 'qr' || moment === 'bars';
    this.phone.root.visible = false;
    this.globe.root.visible = moment === 'globe';
    this.cubeMaterial.emissiveIntensity = 0;
    this.cubeMaterial.color.copy(moment === 'bars' ? MINT : INK);
    this.chain.pose(0, moment === 'hero' ? 0 : 1, 0, 0, 0, moment === 'pricing' || moment === 'cta' ? 1 : 0);
    this.poseSplit(stage, box, scratch.a, 0, 0); // hidden unless the split pose below shows them
    this.padlock.pose(0, 0);

    if (moment === 'hero') {
      this.chain.place(stage, box);
    } else if (moment === 'qr') {
      fit(stage, box, qr, this.qrSize + QR_MARGIN, this.qrSize + QR_MARGIN);
      this.chain.set(stage, qr.position, 0);
      this.cubes.forEach((cube, i) => this.setCube(i, qr.apply(cube.qr, scratch.a), qr.rotation, MODULE * qr.scale));
    } else if (moment === 'bars') {
      fit(stage, box, bars, this.barsSize.width, this.barsSize.height, this.barsTurn);
      this.cubes.forEach((cube, i) => this.setCube(i, bars.apply(cube.bar, scratch.a), bars.rotation, CUBE * bars.scale));
      this.chain.set(stage, bars.apply({ x: this.barTop.x, y: this.barTop.y + 1.3, z: this.barTop.z }, scratch.a), this.linkOnBars());
    } else if (moment === 'globe') {
      fit(stage, box, globe, GLOBE_SPAN, GLOBE_SPAN);
      this.globe.root.position.copy(globe.position);
      this.globe.root.quaternion.copy(globe.rotation);
      this.globe.root.scale.setScalar(globe.scale);
      this.chain.set(stage, this.orbit(2, scratch.a), this.linkAtGlobe()); // in front, right of centre
      this.globe.pose(2, 1, this.chain.root.position);
    } else if (moment === 'split') {
      const scale = this.splitStation(stage, box, scratch.a);
      this.chain.set(stage, scratch.a, scale);
      this.poseSplit(stage, box, this.chain.root.position, scale, 1);
    } else if (moment === 'lock') {
      fit(stage, box, lock, LOCK_SPAN, LOCK_SPAN);
      this.chain.set(stage, lock.position, 0); // shut inside
      this.padlock.pose(1, 1);
      this.padlock.root.position.copy(lock.position);
      this.padlock.root.quaternion.copy(lock.rotation);
      this.padlock.root.scale.setScalar(lock.scale);
    } else if (moment === 'pricing') {
      this.chain.set(stage, scratch.a, this.stationIn(stage, box, 0.5, 0.5, Math.min(box.width * 0.7, box.height * 1.5), scratch.a));
    } else {
      this.chain.set(stage, scratch.a, this.stationIn(stage, box, 0.5, 0.5, Math.min(box.width, box.height) * 0.9, scratch.a));
    }
    this.cubeMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.chain.dispose();
    this.phone.dispose();
    this.globe.dispose();
    this.padlock.dispose();
    this.splitChains.forEach((c) => c.dispose());
    this.dots.forEach((dot) => dot.removeFromParent());
    this.dotGeometry.dispose();
    this.splitMaterial.dispose();
    this.cubeMesh.removeFromParent();
    this.cubeMesh.dispose();
    this.cubeGeometry.dispose();
    this.cubeMaterial.dispose();
  }

  private poseCubes(p: Progress, qr: Frame, bars: Frame): void {
    const at = scratch.a;
    const turn = scratch.q;
    this.cubes.forEach((cube, i) => {
      if (p.toKnow === 0) {
        // Burst out of the link, then assemble into the QR code, centre first.
        const burst = easeOut(range(p.share, 0.02, 0.25));
        const start = 0.22 + cube.delay * 0.18;
        const settle = ease(range(p.share, start, start + 0.22));
        const local = {
          x: THREE.MathUtils.lerp(cube.burst.x * burst, cube.qr.x, settle),
          y: THREE.MathUtils.lerp(cube.burst.y * burst, cube.qr.y, settle),
          z: THREE.MathUtils.lerp(cube.burst.z * burst, cube.qr.z, settle),
        };
        turn.identity().slerp(cube.tumble, burst * (1 - settle)).premultiply(qr.rotation);
        const size = THREE.MathUtils.lerp(CUBE, MODULE, settle) * qr.scale * easeOut(range(p.share, 0.02, 0.12));
        this.setCube(i, qr.apply(local, at), turn, size);
      } else if (p.know === 0) {
        // Fall from the QR code to the floor under the bar chart, with a small hop — once the next section is in.
        const start = 0.3 + cube.delay * 0.3;
        const u = ease(range(p.toKnow, start, start + 0.4));
        const from = qr.apply(cube.qr, at);
        const to = bars.apply(cube.floor, scratch.b);
        from.lerp(to, u).addScaledVector(UP, Math.sin(Math.PI * u) * 2 * bars.scale);
        turn.copy(qr.rotation).slerp(scratch.r.copy(bars.rotation).multiply(cube.tumble), u);
        this.setCube(i, from, turn, THREE.MathUtils.lerp(MODULE * qr.scale, CUBE * bars.scale, u));
      } else {
        // Rise from the floor into the bars, bottom layers first; then sink away towards the globe.
        const height = this.barTop.y - this.floorY;
        const start = ((cube.bar.y - this.floorY) / height) * 0.4;
        const u = ease(range(p.know, start, start + 0.3));
        const sink = easeIn(range(p.toWhere, 0, 0.5));
        const local = {
          x: THREE.MathUtils.lerp(cube.floor.x, cube.bar.x, u),
          y: THREE.MathUtils.lerp(cube.floor.y, cube.bar.y, u) + Math.sin(Math.PI * u) * 2 - sink * (height + 2),
          z: THREE.MathUtils.lerp(cube.floor.z, cube.bar.z, u),
        };
        turn.copy(bars.rotation).multiply(scratch.r.copy(cube.tumble).slerp(IDENTITY, u));
        this.setCube(i, bars.apply(local, at), turn, CUBE * bars.scale * (1 - sink));
      }
    });
    this.cubeMesh.instanceMatrix.needsUpdate = true;
  }

  /** `size` is the cube's edge in world units (the geometry is a unit cube). */
  private setCube(i: number, position: THREE.Vector3, rotation: THREE.Quaternion, size: number): void {
    this.cubeMesh.setMatrixAt(i, scratch.m.compose(position, rotation, scratch.s.setScalar(Math.max(size, 1e-5))));
  }

  /** A point in `box` (fractions of its size) on the focal plane → `target`; returns the scale for a link `linkPx` wide. */
  private stationIn(stage: Stage, box: Box, fx: number, fy: number, linkPx: number, target: THREE.Vector3): number {
    stage.planePoint(box.left + box.width * fx, box.top + box.height * fy, target);
    return (linkPx * stage.unitsPerPixel()) / LINK_WIDTH;
  }

  /** Where the link sits for the A/B split: the left of its box, a third of the box's height wide. */
  private splitStation(stage: Stage, box: Box, target: THREE.Vector3): number {
    return this.stationIn(stage, box, 0.16, 0.5, box.height * 0.32, target);
  }

  /** Inside the padlock's body (the lock frame must be fitted), half the body wide → `target`; returns the scale. */
  private lockStation(target: THREE.Vector3): number {
    const lock = this.frames.lock;
    lock.apply({ x: 0, y: -PADLOCK_HEIGHT / 2 + 1.3, z: 0 }, target);
    return (1.6 * lock.scale) / LINK_WIDTH;
  }

  /**
   * The A/B moment's two chains, from the link (`start`) to the right edge of `box`, bowing like the page's SVG; link
   * sizes follow the sample weights (60 / 40). `grow` 0–1 extends them; a dot marks each destination once reached.
   */
  private poseSplit(stage: Stage, box: Box, start: THREE.Vector3, linkScale: number, grow: number): void {
    this.splitChains.forEach((chain, i) => {
      const end = stage.planePoint(box.left + box.width * 0.92, box.top + box.height * SPLIT_ENDS[i], scratch.b);
      const control = scratch.s.set((start.x + end.x) / 2, start.y, 0); // leaves level, then turns to its target
      const scale = linkScale * (0.35 + 0.4 * SPLIT_WEIGHTS[i]);
      chain.pose(start, control, end, scale, grow);
      const dot = this.dots[i];
      dot.position.copy(end);
      dot.scale.setScalar(Math.max(scale * 0.9 * easeOut(range(grow, 0.9, 1)), 1e-5));
      dot.visible = grow > 0.9;
    });
  }

  /** Link size resting on the tallest bar: a bit wider than the bar. */
  private linkOnBars(): number {
    return (3.4 / LINK_WIDTH) * this.frames.bars.scale;
  }

  private linkAtGlobe(): number {
    return ((GLOBE_RADIUS * 0.45) / LINK_WIDTH) * this.frames.globe.scale;
  }

  /** The link's orbit around the globe (world), tilted so it passes in front of and behind it. */
  private orbit(seconds: number, target: THREE.Vector3): THREE.Vector3 {
    const angle = seconds * 0.45;
    const r = GLOBE_RADIUS * 1.32;
    return this.frames.globe.apply({ x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.28, z: Math.sin(angle) * r }, target);
  }
}
