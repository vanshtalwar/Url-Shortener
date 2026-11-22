import * as THREE from 'three';
import { Chain, compressionAt, LINK_PITCH, LINK_WIDTH } from './chain';
import { Globe, GLOBE_RADIUS, GlobeOrigin } from './globe';
import { qrSlots } from './layouts';
import { LinkChain } from './link-chain';
import { FrameRateGuard, readDeviceHints, startingTier } from './quality';
import { devFrameCost, devPinnedTier } from './rig';
import { Stage } from './stage';

export type SceneKind = 'chain' | 'pulse' | 'qr' | 'stack' | 'globe';

export interface SceneData {
  clicks?: number; // pulse: today's clicks
  text?: string; // qr: what the code encodes
  origins?: GlobeOrigin[]; // globe: where the clicks came from
}

export interface Scene {
  update(data: SceneData): void;
  stop(): void;
}

interface View {
  pose(stage: Stage, seconds: number): void;
  dispose(): void;
}

/**
 * A small 3D illustration in a box on a dashboard page (prompts/zelqit-frontend.md §4, Phase 3), on its own canvas
 * filling `host` (positioned). Animates only while on screen and the tab is visible, with native scrolling (no GSAP
 * or Lenis); with reduced motion or on a slow device it draws one still frame instead. Marks the host
 * `data-xp-drawn` while drawn. Throws without WebGL. Returns null for the globe when it can't animate: its still
 * form is the 2D map, which shows the whole world at once — the host keeps its fallback content either way.
 */
export function startScene(host: HTMLElement, kind: SceneKind, data: SceneData): Scene | null {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tier = reducedMotion ? 'still' : devPinnedTier() ?? startingTier(readDeviceHints());
  if (kind === 'globe' && (tier === 'still' || tier === 'low')) return null;
  const stage = new Stage(tier === 'low' ? 'still' : tier);
  let view = makeView(kind, stage, data);
  stage.embed(host);

  let seconds = 0;
  let frame = 0;
  let onScreen = false;
  const draw = (at: number) => {
    seconds = at;
    view.pose(stage, at);
    stage.render();
  };
  const resize = () => {
    if (!host.clientWidth || !host.clientHeight) return;
    stage.resize(host.clientWidth, host.clientHeight);
    draw(seconds);
  };
  // Frames only while on screen and the tab is visible; none at all for a still.
  const run = () => {
    const go = stage.tier !== 'still' && onScreen && !document.hidden;
    if (go && !frame) frame = requestAnimationFrame(tick);
    if (!go && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  const guard = devPinnedTier()
    ? null
    : new FrameRateGuard(stage.tier, (next) => {
        if (next !== 'medium' && kind === 'globe') return scene.stop(); // back to the map
        stage.setTier(next === 'medium' ? next : 'still');
        run();
        draw(seconds);
      });
  const start = performance.now();
  const burn = devFrameCost();
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    draw((now - start) / 1000); // from the scene's start: loops begin at their beginning
    if (burn) for (const until = performance.now() + burn; performance.now() < until; ); // dev only: fake a slow device
    guard?.frame(now); // last: it may stop the loop
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    run();
  });
  visibility.observe(host);
  document.addEventListener('visibilitychange', run);
  resize();
  host.dataset['xpDrawn'] = '';

  let stopped = false; // also by the guard (the globe): later calls do nothing
  const scene: Scene = {
    update(next) {
      if (stopped) return;
      view.dispose();
      view = makeView(kind, stage, next);
      draw(seconds);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', run);
      view.dispose();
      stage.dispose();
      delete host.dataset['xpDrawn'];
    },
  };
  return scene;
}

function makeView(kind: SceneKind, stage: Stage, data: SceneData): View {
  switch (kind) {
    case 'chain':
      return chainView(stage);
    case 'pulse':
      return pulseView(stage, data.clicks ?? 0);
    case 'qr':
      return qrView(stage, data.text ?? '');
    case 'stack':
      return stackView(stage);
    case 'globe':
      return globeView(stage, data.origins ?? []);
  }
}

const centre = (stage: Stage, target: THREE.Vector3) => stage.planePoint(stage.width / 2, stage.height / 2, target);

/** No links yet: the landing's chain, compressing into one glowing link and back. */
function chainView(stage: Stage): View {
  const chain = new Chain();
  stage.scene.add(chain.root);
  const at = new THREE.Vector3();
  const length = 4 * LINK_PITCH + LINK_WIDTH; // five links, end to end
  return {
    pose(stage, seconds) {
      chain.pose(seconds, stage.tier === 'still' ? 0 : compressionAt(seconds), 0, 0);
      const width = Math.min(stage.width, stage.height * 2.4) * 0.9; // px; turned, it looks shorter
      chain.set(stage, centre(stage, at), (width * stage.unitsPerPixel()) / length);
    },
    dispose: () => chain.dispose(),
  };
}

/** Overview: one link pulsing — brighter and quicker the more clicks it has had today. */
function pulseView(stage: Stage, clicks: number): View {
  const chain = new Chain();
  stage.scene.add(chain.root);
  const activity = Math.min(1, Math.log10(1 + clicks) / 3); // 0 clicks → 0, 1,000+ → 1
  const period = 2.6 - 1.6 * activity; // seconds per beat
  const at = new THREE.Vector3();
  return {
    pose(stage, seconds) {
      const beat = stage.tier === 'still' ? 1 : 0.5 + 0.5 * Math.sin((2 * Math.PI * seconds) / period);
      chain.pose(seconds, 1, 0, 0, 0, 0, (0.35 + 0.65 * activity) * (0.3 + 0.7 * beat));
      const width = Math.min(stage.width * 0.7, stage.height * 1.2) * (0.97 + 0.03 * beat); // px: room for its tilt
      chain.set(stage, centre(stage, at), (width * stage.unitsPerPixel()) / LINK_WIDTH);
    },
    dispose: () => chain.dispose(),
  };
}

/**
 * No clicks yet: the link's real QR code (it scans) in cubes on a white card — dark on light in either theme, with a
 * 4-module quiet zone — turning a little.
 */
function qrView(stage: Stage, text: string): View {
  const { size, slots } = qrSlots(text);
  const group = new THREE.Group();
  const cubeGeometry = new THREE.BoxGeometry(1.04, 1.04, 1); // neighbours overlap a hair: no seams for scanners
  const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1826, roughness: 0.5, metalness: 0.1, envMapIntensity: 0.35 });
  const cubes = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, slots.length);
  const m = new THREE.Matrix4();
  slots.forEach((slot, i) => cubes.setMatrixAt(i, m.makeTranslation(slot.x, slot.y, 0.5)));
  const cardGeometry = new THREE.BoxGeometry(size + 8, size + 8, 0.8);
  const cardMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const card = new THREE.Mesh(cardGeometry, cardMaterial);
  card.position.z = -0.4;
  group.add(card, cubes);
  stage.scene.add(group);
  return {
    pose(stage, seconds) {
      const turn = stage.tier === 'still' ? 0 : 1;
      group.rotation.set(Math.sin(seconds * 0.4) * 0.08 * turn, Math.sin(seconds * 0.6) * 0.18 * turn, 0);
      centre(stage, group.position);
      group.scale.setScalar((Math.min(stage.width, stage.height) * stage.unitsPerPixel()) / (size + 9));
    },
    dispose() {
      group.removeFromParent();
      cubes.dispose();
      cubeGeometry.dispose();
      cubeMaterial.dispose();
      cardGeometry.dispose();
      cardMaterial.dispose();
    },
  };
}

/** No bio page yet: five links hanging in a column, like the list on a link-in-bio page, swaying gently. */
function stackView(stage: Stage): View {
  const material = new THREE.MeshPhysicalMaterial({ color: 0x8b5cf6, metalness: 1, roughness: 0.22, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3 });
  const chain = new LinkChain(material);
  stage.scene.add(chain.mesh);
  const [top, bottom, bend] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  return {
    pose(stage, seconds) {
      stage.planePoint(stage.width / 2, stage.height * 0.12, top);
      stage.planePoint(stage.width / 2, stage.height * 0.88, bottom);
      const sway = stage.tier === 'still' ? 0.15 : Math.sin(seconds * 0.9);
      bend.lerpVectors(top, bottom, 0.5).x += sway * top.distanceTo(bottom) * 0.12;
      chain.pose(top, bend, bottom, top.distanceTo(bottom) / (5 * LINK_PITCH), 1);
    },
    dispose() {
      chain.dispose();
      material.dispose();
    },
  };
}

/**
 * Link stats (Pro): the landing's dotted globe, marked where this link's visitors are, with their clicks flying to
 * the link orbiting it.
 */
function globeView(stage: Stage, origins: GlobeOrigin[]): View {
  const globe = new Globe(origins);
  globe.simplify(stage.tier !== 'high');
  const chain = new Chain();
  stage.scene.add(globe.root, chain.root);
  const at = new THREE.Vector3();
  return {
    pose(stage, seconds) {
      // Room for the globe and the link's orbit, which is wide but shallow.
      const scale = Math.min(stage.width / (GLOBE_RADIUS * 3.2), stage.height / (GLOBE_RADIUS * 2.6)) * stage.unitsPerPixel();
      centre(stage, globe.root.position);
      globe.root.scale.setScalar(scale);
      // The landing's orbit: tilted, so the link passes in front of and behind the globe.
      const angle = seconds * 0.45;
      const r = GLOBE_RADIUS * 1.32 * scale;
      at.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.28, Math.sin(angle) * r).add(globe.root.position);
      chain.pose(seconds, 1, 0, 0);
      chain.set(stage, at, ((GLOBE_RADIUS * 0.45) / LINK_WIDTH) * scale);
      globe.pose(seconds, 1, chain.root.position);
    },
    dispose() {
      globe.dispose();
      chain.dispose();
    },
  };
}
