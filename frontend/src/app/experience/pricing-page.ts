import * as THREE from 'three';
import { Chain, LINK_WIDTH } from './chain';
import { readDeviceHints, startingTier } from './quality';
import { anchor, Box, devExpose, devPinnedTier, Live, LiveRig, paintStill, startFrames } from './rig';
import { Stage } from './stage';

const DROP_MS = 1600;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2; // a small overshoot as it lands

/**
 * The Pricing page's 3D (prompts/zelqit-frontend.md §4, X8): the Zelqit link drops in above the Pro card, turning
 * once and warming from violet to amber, and settles there. The drop starts when that spot first comes into view
 * (at once on a laptop; when you reach the plans on a phone). Same live and still modes as the journey pages
 * (rig.ts): Lenis, particles and the page palette live; one still frame with reduced motion or on a slow device.
 * `page` holds a `data-xp-anchor="pricing"` box. Rejects without WebGL. The resolved function removes everything.
 */
export async function startPricing(page: HTMLElement): Promise<() => void> {
  const host = anchor(page, 'pricing');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = reducedMotion ? null : await import('./live');
  const stage = new Stage(live ? devPinnedTier() ?? startingTier(readDeviceHints()) : 'still');
  const chain = new Chain();
  stage.scene.add(chain.root);
  const at = new THREE.Vector3();

  let stop = live ? goLive(live) : showStill();

  function goLive(live: Live): () => void {
    const rig = new LiveRig(page, stage, Array.from(page.querySelectorAll<HTMLElement>('section')));
    host.dataset['xpDrawn'] = '';
    const progress = { drop: 0 }; // 0 → 1 over the drop
    devExpose({ xpProgress: progress, xpTier: () => stage.tier });
    let dropStart = -1;

    const draw = (seconds: number) => {
      rig.frame(seconds);
      const box = host.getBoundingClientRect();
      if (dropStart < 0 && box.top < window.innerHeight && box.bottom > 0) dropStart = performance.now();
      progress.drop = dropStart < 0 ? 0 : Math.min(1, (performance.now() - dropStart) / DROP_MS);
      const t = progress.drop;
      chain.pose(seconds, 1, rig.tilt.x, rig.tilt.y, Math.PI * 2 * (1 - ease(t)), ease(t));
      // From just above the screen down to the box's centre.
      stage.planePoint(box.left + box.width / 2, THREE.MathUtils.lerp(-box.height, box.top + box.height / 2, easeOutBack(t)), at);
      chain.set(stage, at, dropStart < 0 ? 0 : linkScale(stage, box));
      stage.render();
    };

    const stopFrames = startFrames(
      live,
      stage,
      draw,
      (tier) => {
        stage.setTier(tier);
        rig.resize();
      },
      () => {
        stop();
        stop = showStill();
      },
    );
    draw(0); // now, so the stand-in can go without a blank frame

    return () => {
      stopFrames();
      rig.stop();
      delete host.dataset['xpDrawn'];
    };
  }

  function showStill(): () => void {
    stage.tier = 'still';
    return paintStill(stage, host, (box) => {
      chain.pose(0, 1, 0, 0, 0, 1);
      chain.set(stage, stage.planePoint(box.width / 2, box.height / 2, at), linkScale(stage, box));
    });
  }

  return () => {
    stop();
    chain.dispose();
    stage.dispose();
  };
}

/** The settled link: 70 % of the box's width (its own proportions keep it inside the box's height). */
function linkScale(stage: Stage, box: Box): number {
  return (Math.min(box.width * 0.7, box.height * 1.5) * stage.unitsPerPixel()) / LINK_WIDTH;
}
